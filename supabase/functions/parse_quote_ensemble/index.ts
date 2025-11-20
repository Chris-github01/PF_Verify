import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ParserResult {
  parser_name: string;
  success: boolean;
  items: any[];
  metadata: any;
  financials: any;
  confidence_score: number;
  extraction_time_ms: number;
  errors?: string[];
  validation?: any;
}

interface EnsembleResult {
  best_result: ParserResult;
  all_results: ParserResult[];
  consensus_items: any[];
  confidence_breakdown: any;
  recommendation: string;
  extraction_metadata: any;
}

async function callExternalExtractor(file: File, apiKey: string): Promise<ParserResult> {
  const startTime = Date.now();
  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("https://verify-pdf-extractor.onrender.com/extract-quote", {
      method: "POST",
      headers: { "X-API-Key": apiKey },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`External extractor failed: ${response.status}`);
    }

    const data = await response.json();

    return {
      parser_name: "external_python_extractor",
      success: true,
      items: data.items || [],
      metadata: {
        supplier_name: data.supplier_name,
        num_pages: data.num_pages,
        tables_count: data.tables?.length || 0,
      },
      financials: {
        grand_total: data.grand_total,
        currency: data.currency || "NZD",
      },
      confidence_score: data.confidence || 0.85,
      extraction_time_ms: Date.now() - startTime,
    };
  } catch (error) {
    return {
      parser_name: "external_python_extractor",
      success: false,
      items: [],
      metadata: {},
      financials: {},
      confidence_score: 0,
      extraction_time_ms: Date.now() - startTime,
      errors: [error.message],
    };
  }
}

async function callMultiModelExtractor(text: string, metadata: any): Promise<ParserResult> {
  const startTime = Date.now();
  try {
    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/extract_quote_multi_model`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text, metadata }),
    });

    if (!response.ok) {
      throw new Error(`Multi-model extraction failed: ${response.status}`);
    }

    const data = await response.json();
    const finalQuote = data.consensus || data.primary;

    return {
      parser_name: "multi_model_ai",
      success: true,
      items: finalQuote.line_items || [],
      metadata: finalQuote.metadata || {},
      financials: finalQuote.financials || {},
      confidence_score: data.confidence_breakdown?.overall || 0.8,
      extraction_time_ms: Date.now() - startTime,
      validation: finalQuote.validation,
    };
  } catch (error) {
    return {
      parser_name: "multi_model_ai",
      success: false,
      items: [],
      metadata: {},
      financials: {},
      confidence_score: 0,
      extraction_time_ms: Date.now() - startTime,
      errors: [error.message],
    };
  }
}

async function callProductionParser(text: string, supplierName: string): Promise<ParserResult> {
  const startTime = Date.now();
  try {
    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/parse_quote_production`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        supplierName,
        documentType: "PDF Quote (Production Parser)",
      }),
    });

    if (!response.ok) {
      throw new Error(`Production parser failed: ${response.status}`);
    }

    const data = await response.json();

    return {
      parser_name: "production_parser",
      success: true,
      items: data.lines || data.items || [],
      metadata: {
        supplier_name: supplierName,
      },
      financials: {
        grand_total: data.totals?.grandTotal || data.grandTotal,
        subtotal: data.totals?.subtotal,
        tax: data.totals?.tax,
      },
      confidence_score: 0.75,
      extraction_time_ms: Date.now() - startTime,
    };
  } catch (error) {
    return {
      parser_name: "production_parser",
      success: false,
      items: [],
      metadata: {},
      financials: {},
      confidence_score: 0,
      extraction_time_ms: Date.now() - startTime,
      errors: [error.message],
    };
  }
}

function buildConsensus(results: ParserResult[]): any[] {
  const successfulResults = results.filter(r => r.success && r.items.length > 0);

  if (successfulResults.length === 0) return [];
  if (successfulResults.length === 1) return successfulResults[0].items;

  const allItems: Map<string, any[]> = new Map();

  for (const result of successfulResults) {
    for (const item of result.items) {
      const key = `${item.description || ''}_${item.quantity || 0}_${item.unit || ''}`.toLowerCase();
      if (!allItems.has(key)) {
        allItems.set(key, []);
      }
      allItems.get(key)!.push({
        ...item,
        source_parser: result.parser_name,
        source_confidence: result.confidence_score,
      });
    }
  }

  const consensusItems: any[] = [];

  for (const [key, items] of allItems) {
    if (items.length === 1) {
      consensusItems.push({
        ...items[0],
        consensus_level: "single_source",
        agreement_count: 1,
      });
    } else {
      const quantities = items.map(i => i.quantity).filter(q => q > 0);
      const unitPrices = items.map(i => i.unit_price || i.unit_rate).filter(p => p > 0);
      const totals = items.map(i => i.total_price || i.line_total).filter(t => t > 0);

      const avgQuantity = quantities.length > 0
        ? quantities.reduce((sum, q) => sum + q, 0) / quantities.length
        : 0;
      const avgUnitPrice = unitPrices.length > 0
        ? unitPrices.reduce((sum, p) => sum + p, 0) / unitPrices.length
        : 0;
      const avgTotal = totals.length > 0
        ? totals.reduce((sum, t) => sum + t, 0) / totals.length
        : 0;

      const bestItem = items.reduce((best, current) =>
        (current.source_confidence > best.source_confidence) ? current : best
      );

      consensusItems.push({
        ...bestItem,
        quantity: avgQuantity || bestItem.quantity,
        unit_price: avgUnitPrice || bestItem.unit_price,
        total_price: avgTotal || bestItem.total_price,
        consensus_level: "multi_source_averaged",
        agreement_count: items.length,
      });
    }
  }

  return consensusItems;
}

function selectBestResult(results: ParserResult[]): ParserResult {
  const successfulResults = results.filter(r => r.success && r.items.length > 0);

  if (successfulResults.length === 0) {
    return results[0] || {
      parser_name: "none",
      success: false,
      items: [],
      metadata: {},
      financials: {},
      confidence_score: 0,
      extraction_time_ms: 0,
    };
  }

  return successfulResults.reduce((best, current) => {
    let bestScore = best.confidence_score * 0.7 + (best.items.length / 100) * 0.3;
    let currentScore = current.confidence_score * 0.7 + (current.items.length / 100) * 0.3;

    return currentScore > bestScore ? current : best;
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const projectId = formData.get("projectId") as string;
    const supplierName = formData.get("supplierName") as string;

    if (!file || !projectId || !supplierName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: apiKeyConfig } = await supabase
      .from("system_config")
      .select("value")
      .eq("key", "RENDER_PDF_EXTRACTOR_API_KEY")
      .maybeSingle();

    const apiKey = apiKeyConfig?.value;

    console.log("Starting ensemble extraction with multiple parsers...");

    const startTime = Date.now();
    const results: ParserResult[] = [];

    if (apiKey) {
      console.log("Running parser 1/3: External Python Extractor");
      const externalResult = await callExternalExtractor(file, apiKey);
      results.push(externalResult);
      console.log(`External extractor: ${externalResult.success ? 'SUCCESS' : 'FAILED'} - ${externalResult.items.length} items, confidence: ${externalResult.confidence_score}`);
    }

    const arrayBuffer = await file.arrayBuffer();
    const textDecoder = new TextDecoder();
    const pdfText = textDecoder.decode(arrayBuffer).slice(0, 50000);

    console.log("Running parser 2/3: Multi-Model AI");
    const multiModelResult = await callMultiModelExtractor(pdfText, {
      pageCount: 1,
      ocrUsed: false,
    });
    results.push(multiModelResult);
    console.log(`Multi-model AI: ${multiModelResult.success ? 'SUCCESS' : 'FAILED'} - ${multiModelResult.items.length} items, confidence: ${multiModelResult.confidence_score}`);

    console.log("Running parser 3/3: Production Parser");
    const productionResult = await callProductionParser(pdfText, supplierName);
    results.push(productionResult);
    console.log(`Production parser: ${productionResult.success ? 'SUCCESS' : 'FAILED'} - ${productionResult.items.length} items, confidence: ${productionResult.confidence_score}`);

    const consensusItems = buildConsensus(results);
    const bestResult = selectBestResult(results);

    const successCount = results.filter(r => r.success).length;
    const avgConfidence = results.reduce((sum, r) => sum + r.confidence_score, 0) / results.length;
    const totalExtractionTime = Date.now() - startTime;

    const crossModelAgreement = consensusItems.filter(item =>
      item.agreement_count && item.agreement_count > 1
    ).length / Math.max(consensusItems.length, 1);

    const ensembleResult: EnsembleResult = {
      best_result: bestResult,
      all_results: results,
      consensus_items: consensusItems,
      confidence_breakdown: {
        overall: Math.max(avgConfidence, bestResult.confidence_score * 0.9),
        parsers_succeeded: successCount,
        parsers_attempted: results.length,
        cross_model_agreement: crossModelAgreement,
        best_parser: bestResult.parser_name,
        best_parser_confidence: bestResult.confidence_score,
      },
      recommendation: successCount >= 2
        ? "HIGH_CONFIDENCE_MULTI_PARSER"
        : successCount === 1
        ? "MODERATE_CONFIDENCE_SINGLE_PARSER"
        : "LOW_CONFIDENCE_MANUAL_REVIEW",
      extraction_metadata: {
        total_extraction_time_ms: totalExtractionTime,
        parsers_used: results.map(r => r.parser_name),
        file_name: file.name,
        file_size: file.size,
        timestamp: new Date().toISOString(),
      },
    };

    return new Response(
      JSON.stringify(ensembleResult),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Ensemble extraction failed:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
