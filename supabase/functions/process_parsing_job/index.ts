import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PDF_EXTRACTOR_BASE_URL = Deno.env.get("PDF_EXTRACTOR_BASE_URL") || "https://verify-pdf-extractor.onrender.com";

interface ParsingJob {
  id: string;
  project_id: string;
  quote_id: string | null;
  supplier_name: string;
  file_name: string;
  file_url: string;
  organisation_id: string;
  user_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const { jobId } = await req.json();

    if (!jobId) {
      return new Response(
        JSON.stringify({ error: "Missing jobId" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: job, error: jobError } = await supabase
      .from("parsing_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      throw new Error("Job not found");
    }

    const typedJob = job as unknown as ParsingJob;

    await supabase
      .from("parsing_jobs")
      .update({
        status: "processing",
        progress: 10,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from("quote-uploads")
      .download(typedJob.file_url);

    if (downloadError || !fileData) {
      await supabase
        .from("parsing_jobs")
        .update({
          status: "failed",
          error_message: "Failed to download file",
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      throw new Error("Failed to download file");
    }

    await supabase
      .from("parsing_jobs")
      .update({
        progress: 30,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    const fileBuffer = await fileData.arrayBuffer();
    const fileName = typedJob.file_name.toLowerCase();
    let parsedLines = [];

    try {
      let allPages: string[] = [];
      let useExternalExtractor = false;

      if (fileName.endsWith(".pdf")) {
        console.log("Attempting to use external PDF extractor API...");

        try {
          const { data: apiKeyData } = await supabase
            .from("system_config")
            .select("value")
            .eq("key", "PDF_EXTRACTOR_API_KEY")
            .single();

          const pdfExtractorKey = apiKeyData?.value || Deno.env.get("PDF_EXTRACTOR_API_KEY");

          const file = new File([fileBuffer], typedJob.file_name, { type: "application/pdf" });
          const formData = new FormData();
          formData.append("file", file);

          const extractorHeaders: Record<string, string> = {};
          if (pdfExtractorKey) {
            extractorHeaders["X-API-Key"] = pdfExtractorKey;
          }

          const extractorResponse = await fetch(`${PDF_EXTRACTOR_BASE_URL}/extract-quote`, {
            method: "POST",
            headers: extractorHeaders,
            body: formData,
          });

          if (extractorResponse.ok) {
            const extractorData = await extractorResponse.json();
            console.log("External PDF extractor succeeded:", {
              filename: extractorData.filename,
              num_pages: extractorData.num_pages,
              text_length: extractorData.text?.length || 0,
              tables_count: extractorData.tables?.length || 0
            });

            if (extractorData.text && extractorData.text.length > 0) {
              allPages.push(extractorData.text);
              useExternalExtractor = true;
              console.log("Using external extractor result (text + tables), skipping built-in PDF parsing");

              await supabase
                .from("parsing_jobs")
                .update({
                  progress: 40,
                  metadata: {
                    extractor_used: "external",
                    num_pages: extractorData.num_pages,
                    tables_count: extractorData.tables?.length || 0
                  },
                  updated_at: new Date().toISOString(),
                })
                .eq("id", jobId);
            }
          } else {
            console.log(`External extractor failed with status ${extractorResponse.status}, falling back to built-in parser`);
          }
        } catch (extractorError) {
          console.log("External extractor error, falling back to built-in parser:", extractorError.message);
        }

        if (!useExternalExtractor) {
          console.log("Processing PDF file with built-in text extraction...");

        const pdfjsLib = await import("npm:pdfjs-dist@4.0.379");

        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(fileBuffer),
          useWorkerFetch: false,
          isEvalSupported: false,
          useSystemFonts: true,
        });

        const pdfDocument = await loadingTask.promise;
        const numPages = pdfDocument.numPages;
        console.log(`PDF has ${numPages} pages, extracting text...`);

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
          const page = await pdfDocument.getPage(pageNum);
          const textContent = await page.getTextContent();

          let lastY = -1;
          let pageText = '';

          textContent.items.forEach((item: any) => {
            const currentY = item.transform[5];
            if (lastY !== -1 && Math.abs(currentY - lastY) > 5) {
              pageText += '\n';
            } else if (pageText.length > 0) {
              pageText += ' ';
            }
            pageText += item.str;
            lastY = currentY;
          });

          allPages.push(pageText);
          console.log(`Extracted page ${pageNum}/${numPages}: ${pageText.length} chars`);
        }

        console.log(`Total pages extracted: ${allPages.length}`);

        await supabase
          .from("parsing_jobs")
          .update({
            progress: 40,
            metadata: { extractor_used: "builtin" },
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);
        }

      } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        console.log("Processing Excel file...");
        const XLSX = await import("npm:xlsx@0.18.5");
        const workbook = XLSX.read(new Uint8Array(fileBuffer), { type: "array" });

        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
          const sheetText = `Sheet: ${sheetName}\n${JSON.stringify(jsonData, null, 2)}`;
          allPages.push(sheetText);
        }

        await supabase
          .from("parsing_jobs")
          .update({
            progress: 40,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);

      } else {
        throw new Error("Unsupported file format");
      }

      const CHUNK_SIZE = 2;
      const chunks: string[] = [];

      for (let i = 0; i < allPages.length; i += CHUNK_SIZE) {
        const chunkPages = allPages.slice(i, i + CHUNK_SIZE);
        const chunkText = chunkPages.map((page, idx) => `--- Page ${i + idx + 1} ---\n${page}`).join('\n\n');
        chunks.push(chunkText);
      }

      const totalChunks = chunks.length;
      console.log(`Split into ${totalChunks} chunks (${CHUNK_SIZE} pages per chunk)`);

      await supabase
        .from("parsing_jobs")
        .update({
          progress: 50,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      const chunkRecords = chunks.map((text, idx) => ({
        job_id: jobId,
        chunk_number: idx + 1,
        total_chunks: totalChunks,
        chunk_text: text,
        status: 'pending'
      }));

      await supabase.from("parsing_chunks").insert(chunkRecords);

      const llmUrl = `${supabaseUrl}/functions/v1/parse_quote_llm_fallback`;
      const llmHeaders = {
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
      };

      const allItems: any[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunkNum = i + 1;
        console.log(`Processing chunk ${chunkNum}/${totalChunks}...`);

        await supabase
          .from("parsing_chunks")
          .update({ status: 'processing' })
          .eq("job_id", jobId)
          .eq("chunk_number", chunkNum);

        const chunkText = `${chunks[i]}\n\nSupplier: ${typedJob.supplier_name}\nDocument: ${typedJob.file_name}\nChunk ${chunkNum} of ${totalChunks}`;

        const timeoutMs = 180000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        let llmRes;
        try {
          llmRes = await fetch(llmUrl, {
            method: "POST",
            headers: llmHeaders,
            body: JSON.stringify({
              text: chunkText,
              supplierName: typedJob.supplier_name,
              documentType: fileName.endsWith(".pdf") ? "PDF Quote" : "Excel Quote",
              chunkInfo: `Chunk ${chunkNum}/${totalChunks}`
            }),
            signal: controller.signal,
          });
        } catch (fetchError) {
          clearTimeout(timeoutId);
          const errorMsg = fetchError.name === 'AbortError' ? 'Request timeout (180s)' : fetchError.message;
          console.error(`Chunk ${chunkNum} fetch failed:`, errorMsg);

          await supabase
            .from("parsing_chunks")
            .update({
              status: 'failed',
              error_message: errorMsg
            })
            .eq("job_id", jobId)
            .eq("chunk_number", chunkNum);

          continue;
        }

        clearTimeout(timeoutId);

        if (!llmRes.ok) {
          const errorText = await llmRes.text();
          console.error(`Chunk ${chunkNum} parsing failed:`, errorText);

          await supabase
            .from("parsing_chunks")
            .update({
              status: 'failed',
              error_message: errorText
            })
            .eq("job_id", jobId)
            .eq("chunk_number", chunkNum);

          continue;
        }

        const parseResult = await llmRes.json();

        if (!parseResult.success || parseResult.error) {
          const errorMsg = parseResult.error || 'LLM parsing failed without error message';
          console.error(`Chunk ${chunkNum} LLM parser error:`, errorMsg);

          await supabase
            .from("parsing_chunks")
            .update({
              status: 'failed',
              error_message: errorMsg
            })
            .eq("job_id", jobId)
            .eq("chunk_number", chunkNum);

          continue;
        }

        const chunkItems = parseResult.lines || parseResult.items || [];

        await supabase
          .from("parsing_chunks")
          .update({
            status: 'completed',
            parsed_items: chunkItems
          })
          .eq("job_id", jobId)
          .eq("chunk_number", chunkNum);

        allItems.push(...chunkItems);
        console.log(`Chunk ${chunkNum} completed: ${chunkItems.length} items (total so far: ${allItems.length})`);

        const progress = 50 + Math.floor((chunkNum / totalChunks) * 30);
        await supabase
          .from("parsing_jobs")
          .update({
            progress,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);
      }

      const uniqueItems = new Map();
      allItems.forEach(item => {
        const key = `${item.description}_${item.qty}_${item.rate}_${item.total}`;
        if (!uniqueItems.has(key)) {
          uniqueItems.set(key, item);
        }
      });

      parsedLines = Array.from(uniqueItems.values());
      console.log(`All chunks processed. Total items before dedup: ${allItems.length}, after dedup: ${parsedLines.length}`);

      await supabase
        .from("parsing_jobs")
        .update({
          progress: 80,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      let quoteId = typedJob.quote_id;

      if (!quoteId) {
        const { data: newQuote, error: quoteError } = await supabase
          .from("quotes")
          .insert({
            project_id: typedJob.project_id,
            supplier_name: typedJob.supplier_name,
            total_amount: 0,
            items_count: parsedLines.length,
            status: "pending",
            user_id: typedJob.user_id,
            organisation_id: typedJob.organisation_id,
          })
          .select()
          .single();

        if (quoteError || !newQuote) {
          console.error("Failed to create quote:", quoteError);
          console.error("Quote error details:", JSON.stringify(quoteError, null, 2));
          throw new Error(`Failed to create quote: ${quoteError?.message || 'Unknown error'}`);
        }

        quoteId = newQuote.id;
      }

      console.log(`Total parsed lines after dedup: ${parsedLines.length}`);
      if (parsedLines.length > 0) {
        console.log(`Sample parsed line:`, JSON.stringify(parsedLines[0]));
      }

      if (parsedLines.length > 0) {
        const quoteItems = parsedLines
          .filter((line: any) => line.description && line.description.trim().length > 0)
          .map((line: any) => ({
            quote_id: quoteId,
            description: line.description.trim(),
            quantity: parseFloat(line.qty) || 0,
            unit: line.unit || '',
            unit_price: parseFloat(line.rate) || 0,
            total_price: parseFloat(line.total) || 0,
            scope_category: line.section || null,
            is_excluded: false,
            notes: line.confidence ? `Confidence: ${line.confidence}` : null,
          }));

        console.log(`Filtered to ${quoteItems.length} valid items (removed ${parsedLines.length - quoteItems.length} empty descriptions)`);

        if (quoteItems.length === 0) {
          console.error("All parsed lines had empty descriptions!");
          throw new Error("No valid items to insert - all descriptions were empty");
        }

        const { error: itemsError } = await supabase
          .from("quote_items")
          .insert(quoteItems);

        if (itemsError) {
          console.error("Failed to insert quote items:", itemsError);
          console.error("Quote items error details:", JSON.stringify(itemsError, null, 2));
          console.error("Sample item that failed:", JSON.stringify(quoteItems[0], null, 2));
          throw new Error(`Failed to insert quote items: ${itemsError.message}`);
        }

        console.log(`Successfully inserted ${quoteItems.length} quote items`);

        const totalAmount = parsedLines.reduce((sum: number, line: any) => sum + (line.total || 0), 0);
        await supabase
          .from("quotes")
          .update({
            total_amount: totalAmount,
            items_count: parsedLines.length,
          })
          .eq("id", quoteId);
      }

      await supabase
        .from("parsing_jobs")
        .update({
          quote_id: quoteId,
          status: "completed",
          progress: 100,
          parsed_lines: parsedLines,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      return new Response(
        JSON.stringify({
          success: true,
          jobId,
          quoteId,
          linesCount: parsedLines.length,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );

    } catch (parseError) {
      console.error("Parsing error:", parseError);

      await supabase
        .from("parsing_jobs")
        .update({
          status: "failed",
          error_message: parseError.message || "Parsing failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      throw parseError;
    }

  } catch (error) {
    console.error("Error processing job:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});