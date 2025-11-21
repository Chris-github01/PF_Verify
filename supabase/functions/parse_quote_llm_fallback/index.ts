import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface LineItem {
  description: string;
  qty: number;
  unit: string;
  rate: number;
  total: number;
  section?: string;
}

interface ParseRequest {
  text?: string;
  chunks?: any;
  supplierName?: string;
  documentType?: string;
  chunkInfo?: string;
}

interface ParseResponse {
  success: boolean;
  items: LineItem[];
  totals: {
    subtotal?: number;
    gst?: number;
    grandTotal?: number;
  };
  metadata: {
    supplier?: string;
    project?: string;
    date?: string;
    reference?: string;
  };
  confidence: number;
  warnings: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { createClient } = await import("npm:@supabase/supabase-js@2.57.4");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: configData, error: configError } = await supabase
      .from("system_config")
      .select("value")
      .eq("key", "OPENAI_API_KEY")
      .single();

    const openaiApiKey = configData?.value || Deno.env.get("OPENAI_API_KEY");

    // Check for xAI API key for dual-parser mode
    const { data: xaiConfigData } = await supabase
      .from("system_config")
      .select("value")
      .eq("key", "XAI_API_KEY")
      .single();

    const xaiApiKey = xaiConfigData?.value || Deno.env.get("XAI_API_KEY");
    const useDualParser = !!xaiApiKey;

    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (useDualParser) {
      console.log('[LLM Fallback] Dual-LLM mode enabled (OpenAI + Grok)');
    } else {
      console.log('[LLM Fallback] Single-LLM mode (OpenAI only)');
    }

    const { text, supplierName, documentType, chunkInfo }: ParseRequest = await req.json();

    if (!text || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "No text provided" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Detect chunk size for adaptive strategy
    const textLength = text.length;
    const isLargeChunk = textLength > 5000;
    const isVeryLargeChunk = textLength > 10000;

    // STEP 1: Count line items (skip for very large chunks to save tokens)
    let countData: any;

    if (isVeryLargeChunk) {
      // For very large chunks, estimate instead of counting
      const estimatedItems = Math.ceil(textLength / 400); // Rough estimate: 1 item per 400 chars
      countData = {
        lineItemCount: estimatedItems,
        quoteTotalAmount: 0,
        notes: 'Estimated count (chunk too large for detailed counting)'
      };
      console.log(`[LLM Fallback] ESTIMATED ${estimatedItems} items (${textLength} chars, too large for counting)`);

    } else {
      // For small/medium chunks, do proper counting
      const countingPrompt = isLargeChunk
        ? `Count line items in this construction quote. Line items have specific descriptions (e.g., "PVC Pipe 100mm"). Skip subtotals (e.g., "INSULATION", "MASTIC"). Return JSON: {"lineItemCount": number, "quoteTotalAmount": number}\n\n${text}`
        : `You are analyzing a construction quote to count ACTUAL LINE ITEMS ONLY.

IMPORTANT DISTINCTION:
- LINE ITEM: A specific product/service with detailed description (e.g., "PVC Pipe 100mm Concrete Floor", "Cable Bundle Up to 40mm")
- SUBTOTAL: A category summary that aggregates multiple line items (e.g., "COMPRESSIVE SEAL", "COLLAR", "CAVITY BARRIER", "Subtotal for Section A")

COUNT ONLY LINE ITEMS. DO NOT count:
- Section subtotals (usually generic category names with large amounts)
- Grand totals
- Table headers
- Page numbers

CLUES that something is a SUBTOTAL, not a line item:
- Generic one-word or two-word category name (e.g., "INSULATION", "MASTIC", "DOOR SEAL")
- Quantity of 1 with unusually large total (>$40,000)
- The word "subtotal" or "sub-total" in the description
- Appears at the end of a section before moving to a new category

Return JSON:
{
  "lineItemCount": number,
  "quoteTotalAmount": number,
  "notes": "brief explanation of how you distinguished line items from subtotals"
}

DOCUMENT:
${text}`;

      console.log('[LLM Fallback] Step 1: Counting line items...', textLength, 'chars');

      const countResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "user", content: countingPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
          max_completion_tokens: 500,
        }),
      });

      if (!countResponse.ok) {
        const errorText = await countResponse.text();
        console.error('[LLM Fallback] Count request failed:', errorText);
        throw new Error(`OpenAI API error (count): ${countResponse.status}`);
      }

      const countResult = await countResponse.json();
      countData = JSON.parse(countResult.choices?.[0]?.message?.content || '{}');

      console.log('[LLM Fallback] Expected line items:', countData.lineItemCount);
      console.log('[LLM Fallback] Quote total from PDF:', countData.quoteTotalAmount);
      console.log('[LLM Fallback] Notes:', countData.notes);
    }

    const pdfGrandTotal = countData.quoteTotalAmount || 0;

    console.log(`[LLM Fallback] Text: ${textLength} chars, Strategy: ${isVeryLargeChunk ? 'ULTRA-SIMPLE' : isLargeChunk ? 'SIMPLIFIED' : 'STANDARD'}`);

    // STEP 2: Adaptive extraction based on chunk size
    let systemPrompt: string;
    let userPrompt: string;

    if (isVeryLargeChunk) {
      // VERY LARGE chunks (>10K): Minimal prompt, table-only focus
      systemPrompt = `Extract line items from quote. ONLY extract table rows with all 5 columns filled.

Rules:
1. Must have: Description + Qty + Unit + Rate + Total
2. Skip: Headers, subtotals, totals, empty rows
3. Description must be specific (not "INSULATION" or "MASTIC")

JSON: {"items": [{"description":"","qty":0,"unit":"","rate":0,"total":0}]}`;

      userPrompt = `Find ~${countData.lineItemCount} items:\n\n${text}`;

    } else if (isLargeChunk) {
      // LARGE chunks (5-10K): Simplified prompt
      systemPrompt = `Extract ${countData.lineItemCount} line items from construction quote.

EXTRACT line items with specific descriptions (e.g., "PVC Pipe 100mm").
SKIP subtotals with generic names (e.g., "COMPRESSIVE SEAL", "COLLAR").

Each item needs:
- description: specific product/service
- qty: quantity number
- unit: unit (M, Nr, EA)
- rate: unit price
- total: line total

JSON:
{"items": [{"description":"","qty":0,"unit":"","rate":0,"total":0}], "warnings": []}`;

      userPrompt = `Extract items from:\n\n${text}\n\n${supplierName ? `Supplier: ${supplierName}` : ''}`;

    } else {
      // STANDARD chunks (<5K): Detailed prompt
      systemPrompt = `Extract approximately ${countData.lineItemCount} ACTUAL LINE ITEMS from this construction quote.

CRITICAL: Extract ONLY line items. DO NOT extract section subtotals or category summaries.

LINE ITEM vs SUBTOTAL:
- LINE ITEM: Specific product/service with detailed description (e.g., "PVC Pipe 100mm Concrete Floor qty:933 @$129.38")
- SUBTOTAL: Generic category summary (e.g., "COMPRESSIVE SEAL $809,496" - this is the sum of multiple line items)

DO NOT EXTRACT:
- Section subtotals (generic category names like "COMPRESSIVE SEAL", "COLLAR", "CAVITY BARRIER", "INSULATION", "MASTIC")
- Rows where qty=1 and total is very large (likely a subtotal, not a single item)
- Lines that say "subtotal", "sub-total", "section total"
- Grand totals or estimate totals
- Table headers or page numbers

For each ACTUAL LINE ITEM extract:
- description: detailed text describing the specific item
- qty: quantity from quantity column
- unit: unit of measure (M, Nr, EA, etc)
- rate: unit price (calculate as total/qty if not shown)
- total: total price for this line
- section: category/section name if visible
- isSubtotal: true if you suspect this is a subtotal (helps with filtering)

Return JSON:
{
  "items": [{"description": "string", "qty": number, "unit": "string", "rate": number, "total": number, "section": "string", "isSubtotal": boolean}],
  "confidence": number,
  "warnings": ["string"]
}`;

      userPrompt = `Extract all line items from this quote:

${text}

${supplierName ? `Supplier: ${supplierName}` : ''}

Return JSON with all items found.`;
    }

    console.log('[LLM Fallback] Step 2: Extracting', countData.lineItemCount, 'items...');

    // Adaptive token limits based on chunk size
    const maxTokens = isVeryLargeChunk ? 4096 : isLargeChunk ? 8192 : 16384;
    console.log(`[LLM Fallback] Max completion tokens: ${maxTokens}`);

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_completion_tokens: maxTokens,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('[LLM Fallback] OpenAI error:', errorText);
      throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorText}`);
    }

    const openaiResult = await openaiResponse.json();
    const content = openaiResult.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    console.log('[LLM Fallback] Got response, parsing JSON...');
    const parsed: ParseResponse = JSON.parse(content);

    const rawItems = parsed.items || [];
    console.log(`[LLM Fallback] Raw items from LLM: ${rawItems.length}`);

    const TOTAL_PATTERNS = [
      /^grand[-\s]?total$/i,
      /^total[-\s]?estimate$/i,
      /\btotal\s*estimate\s*:/i,
      /\bgrand\s*total\s*:/i,
      /^subtotal$/i,
      /^sub[-\s]?total$/i,
    ];

    const EXCLUSION_PATTERNS = [
      /\b(contingency|allowance|provisional)\b/i,
      /\b(cost[-\s]?increase|escalation|price[-\s]?adjustment)\b/i,
      /\b(excluded|omitted|not[-\s]?included)\b/i,
      /\b(alternate|alternative|option)\b/i,
      /\b(carried[-\s]?forward|brought[-\s]?forward|c\/f|b\/f)\b/i,
      /\b(provisional[-\s]?sum)\b/i,
    ];

    // Pattern to detect section subtotals: single-word categories with large totals
    const SECTION_SUBTOTAL_PATTERNS = [
      /^(compressive[-\s]?seal|collar|cavity[-\s]?barrier|cable[-\s]?bundle|insulation|door[-\s]?perimeter[-\s]?seal|mastic|fire[-\s]?protection|duct|pipe|cable|penetration|seal|barrier)$/i,
    ];

    const HEADER_PATTERNS = /\b(item|description|qty|quantity|rate|unit|price|amount|total|service|size|substrate|section)\b/i;

    const filteredItems = rawItems.filter(item => {
      const desc = (item.description || '').trim().toLowerCase();

      if (desc.length === 0) {
        console.log(`[Filter] Excluding empty description`);
        return false;
      }

      // If LLM marked it as a subtotal, exclude it
      if (item.isSubtotal === true) {
        console.log(`[Filter] Excluding LLM-identified subtotal: "${item.description}"`);
        return false;
      }

      if (TOTAL_PATTERNS.some(p => p.test(desc))) {
        console.log(`[Filter] Excluding total row: "${item.description}"`);
        return false;
      }

      if (EXCLUSION_PATTERNS.some(p => p.test(desc))) {
        console.log(`[Filter] Excluding contingency/exclusion: "${item.description}"`);
        return false;
      }

      // Exclude section subtotals: generic category names with qty=1 and very large totals
      const total = item.total || 0;
      const qty = item.qty || 1;
      if (qty === 1 && total > 40000 && SECTION_SUBTOTAL_PATTERNS.some(p => p.test(desc))) {
        console.log(`[Filter] Excluding section subtotal: "${item.description}" ($${total})`);
        return false;
      }

      const hasNoNumbers = !item.qty && !item.rate && !item.total;
      if (hasNoNumbers && HEADER_PATTERNS.test(desc)) {
        console.log(`[Filter] Excluding header: "${item.description}"`);
        return false;
      }

      return true;
    });

    console.log(`[LLM Fallback] After filtering: ${filteredItems.length} items (excluded ${rawItems.length - filteredItems.length})`);

    // RE-JOIN LINE ITEMS: Handle descriptions split across multiple lines
    const rejoinedItems: any[] = [];
    let currentItem: any | null = null;

    for (const item of filteredItems) {
      const desc = (item.description || '').trim();
      const hasNumbers = item.qty || item.total || item.rate;

      // Check if this is a continuation line (lowercase start or no numbers)
      const firstChar = desc.charAt(0);
      const startsLowercase = firstChar === firstChar.toLowerCase() && firstChar !== firstChar.toUpperCase();
      const isContinuation = (startsLowercase || (!hasNumbers && desc.length > 0)) && currentItem;

      if (isContinuation && currentItem) {
        // Append to current item
        currentItem.description = `${currentItem.description || ''} ${desc}`.trim();
        if (!currentItem.qty && item.qty) currentItem.qty = item.qty;
        if (!currentItem.unit && item.unit) currentItem.unit = item.unit;
        if (!currentItem.rate && item.rate) currentItem.rate = item.rate;
        if (!currentItem.total && item.total) currentItem.total = item.total;
      } else {
        // Start new item
        if (currentItem) {
          rejoinedItems.push(currentItem);
        }
        currentItem = { ...item };
      }
    }

    if (currentItem) {
      rejoinedItems.push(currentItem);
    }

    const mergedCount = filteredItems.length - rejoinedItems.length;
    if (mergedCount > 0) {
      console.log(`[Line Rejoining] Merged ${mergedCount} continuation lines`);
    }

    // Add line numbers to each item for tracking
    const itemsWithLineNumbers = rejoinedItems.map((item, index) => ({
      ...item,
      lineNumber: index + 1,
      description: (item.description || '').replace(/\s+/g, ' ').trim()
    }));

    console.log(`[LLM Fallback] Added line numbers to ${itemsWithLineNumbers.length} items`);

    // Fix quantities and rates
    const fixedItems = itemsWithLineNumbers.map(item => {
      let qty = item.qty || 1;
      const total = item.total || 0;
      let rate = item.rate || 0;

      // CRITICAL: Force quantities to be integers
      if (qty !== Math.floor(qty)) {
        const originalQty = qty;
        // If decimal is very close to 1 (like 1.0 or 0.99), assume qty=1
        if (qty > 0.8 && qty < 1.2) {
          qty = 1;
        } else {
          // Otherwise round to nearest integer
          qty = Math.round(qty);
        }
        console.log(`[Qty Fix] "${item.description}": qty was ${originalQty} (decimal), corrected to ${qty} (integer)`);
      }

      // Ensure qty is at least 1
      if (qty < 1) {
        console.log(`[Qty Fix] "${item.description}": qty was ${qty}, corrected to 1`);
        qty = 1;
      }

      // Fix rate: ensure rate = total / qty
      // If rate is suspiciously close to total (when qty > 1), recalculate
      if (qty > 1 && rate > total * 0.9) {
        const correctedRate = Math.round((total / qty) * 100) / 100;
        console.log(`[Rate Fix] "${item.description}": qty=${qty}, rate was ${rate}, corrected to ${correctedRate}`);
        rate = correctedRate;
      }

      // If no rate provided, calculate it
      if (!rate && total && qty) {
        const calculatedRate = Math.round((total / qty) * 100) / 100;
        console.log(`[Rate Fix] "${item.description}": calculated rate = ${calculatedRate}`);
        rate = calculatedRate;
      }

      return { ...item, qty, rate };
    });

    console.log(`[LLM Fallback] Expected: ${countData.lineItemCount}, Got: ${fixedItems.length}`);

    // TOTALS RECONCILIATION CHECK (catches 3-4% of errors)
    const extractedTotal = fixedItems.reduce((sum, item) => sum + (item.total || 0), 0);
    const tolerance = 0.005; // 0.5%
    let totalsMismatch = false;
    let reconciliationWarning = '';

    if (pdfGrandTotal > 0) {
      const percentageDiff = Math.abs(extractedTotal - pdfGrandTotal) / pdfGrandTotal;
      if (percentageDiff > tolerance) {
        totalsMismatch = true;
        reconciliationWarning = `TOTALS_MISMATCH: Extracted $${extractedTotal.toFixed(2)} vs PDF Grand Total $${pdfGrandTotal.toFixed(2)} (${(percentageDiff * 100).toFixed(2)}% diff)`;
        console.error(`[Reconciliation] ${reconciliationWarning}`);
      } else {
        console.log(`[Reconciliation] ✓ PASS: Extracted $${extractedTotal.toFixed(2)} vs PDF $${pdfGrandTotal.toFixed(2)} (${(percentageDiff * 100).toFixed(3)}% diff)`);
      }
    } else {
      console.warn(`[Reconciliation] SKIPPED: No PDF grand total available`);
    }

    if (Math.abs(fixedItems.length - countData.lineItemCount) > 10) {
      console.warn(`[LLM Fallback] WARNING: Item count mismatch! Expected ${countData.lineItemCount}, got ${fixedItems.length}`);
    }

    console.log('[LLM Fallback] Success:', fixedItems.length, 'items, confidence:', parsed.confidence);

    const warnings = [...(parsed.warnings || [])];
    if (totalsMismatch) {
      warnings.push(reconciliationWarning);
    }

    return new Response(
      JSON.stringify({
        success: true,
        lines: fixedItems,
        items: fixedItems,
        confidence: totalsMismatch ? Math.min(parsed.confidence || 0.8, 0.75) : parsed.confidence,
        warnings: warnings,
        metadata: {
          expectedItemCount: countData.lineItemCount,
          actualItemCount: fixedItems.length,
          quoteTotalAmount: pdfGrandTotal,
          extractedTotal: extractedTotal,
          totalsMismatch: totalsMismatch,
          reconciliationStatus: totalsMismatch ? 'FAILED' : 'PASSED',
        },
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );

  } catch (error) {
    console.error('[LLM Fallback] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        lines: [],
        items: [],
        totals: {},
        metadata: {},
        confidence: 0,
        warnings: ['Parse failed'],
      }),
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