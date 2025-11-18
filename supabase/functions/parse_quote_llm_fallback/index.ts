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

    // STEP 1: Count billable line items (NOT section totals)
    const countingPrompt = `Count billable line items in this construction quote.

A LINE ITEM has all of: description, quantity, unit, rate, total.

DO NOT COUNT:
- Rows with "subtotal", "sub-total", "section total"
- Rows with "total", "grand total", "total estimate"
- Section headers (even if they have amounts)
- Table headers

Also extract the document's grand total amount.

Return JSON:
{
  "lineItemCount": number,
  "quoteTotalAmount": number
}

DOCUMENT:
${text}`;

    console.log('[LLM Fallback] Step 1: Counting line items...', text.length, 'chars');

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
    const countData = JSON.parse(countResult.choices?.[0]?.message?.content || '{}');

    console.log('[LLM Fallback] Expected line items:', countData.lineItemCount);
    console.log('[LLM Fallback] Quote structure:', countData.structure);
    console.log('[LLM Fallback] Notes:', countData.notes);

    // STEP 2: Extract line items (excluding subtotals)
    const systemPrompt = `Extract ${countData.lineItemCount} billable line items from this construction quote.

EXTRACT ONLY line items with: description, quantity, unit, rate/price, total.

DO NOT EXTRACT:
- Subtotals (rows with "subtotal", "sub-total", "section total")
- Grand totals (rows with "total", "grand total", "total estimate")
- Section headers without quantity/rate details
- Table headers, page numbers

For each item extract:
- description: item description
- qty: quantity (integer)
- unit: unit of measure
- rate: unit price (calculate as total/qty if not shown)
- total: line total
- section: section/category name

Return JSON:
{
  "items": [{"description": "string", "qty": number, "unit": "string", "rate": number, "total": number, "section": "string"}],
  "confidence": number,
  "warnings": ["string"]
}`;

    const userPrompt = `Extract all line items from this quote:

${text}

${supplierName ? `Supplier: ${supplierName}` : ''}

Return JSON with all items found.`;

    console.log('[LLM Fallback] Step 2: Extracting', countData.lineItemCount, 'items...');

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
        max_completion_tokens: 16384,
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
      /\b(sub[-\s]?total|subtotal)\b/i,
      /\b(section[-\s]?total|block[-\s]?total)\b/i,
      /\b(grand[-\s]?total|total[-\s]?estimate)\b/i,
      /\b(page[-\s]?total)\b/i,
      /^total$/i,
      /\btotal\s*:/i,
    ];

    const EXCLUSION_PATTERNS = [
      /\b(contingency|allowance|provisional)\b/i,
      /\b(cost[-\s]?increase|escalation|price[-\s]?adjustment)\b/i,
      /\b(excluded|omitted|not[-\s]?included)\b/i,
      /\b(alternate|alternative|option)\b/i,
      /\b(carried[-\s]?forward|brought[-\s]?forward|c\/f|b\/f)\b/i,
      /\b(provisional[-\s]?sum)\b/i,
    ];

    const HEADER_PATTERNS = /\b(item|description|qty|quantity|rate|unit|price|amount|total|service|size|substrate|section)\b/i;

    const filteredItems = rawItems.filter(item => {
      const desc = (item.description || '').trim().toLowerCase();

      if (desc.length === 0) {
        console.log(`[Filter] Excluding empty description`);
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

      const hasNoNumbers = !item.qty && !item.rate && !item.total;
      if (hasNoNumbers && HEADER_PATTERNS.test(desc)) {
        console.log(`[Filter] Excluding header: "${item.description}"`);
        return false;
      }

      return true;
    });

    console.log(`[LLM Fallback] After filtering: ${filteredItems.length} items (excluded ${rawItems.length - filteredItems.length})`);

    const seen = new Set<string>();
    const dedupedItems = filteredItems.filter(item => {
      const key = [
        (item.description || '').trim().toLowerCase(),
        (item.qty || 0).toString(),
        (item.rate || 0).toString(),
        (item.unit || '').trim().toLowerCase(),
      ].join('|');

      if (seen.has(key)) {
        console.log(`[Filter] Excluding duplicate: "${item.description}"`);
        return false;
      }
      seen.add(key);
      return true;
    });

    console.log(`[LLM Fallback] After deduplication: ${dedupedItems.length} items`);

    // Fix quantities and rates
    const fixedItems = dedupedItems.map(item => {
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

    if (Math.abs(fixedItems.length - countData.lineItemCount) > 10) {
      console.warn(`[LLM Fallback] WARNING: Item count mismatch! Expected ${countData.lineItemCount}, got ${fixedItems.length}`);
    }

    console.log('[LLM Fallback] Success:', fixedItems.length, 'items, confidence:', parsed.confidence);

    return new Response(
      JSON.stringify({
        success: true,
        lines: fixedItems,
        items: fixedItems,
        confidence: parsed.confidence,
        warnings: parsed.warnings || [],
        metadata: {
          expectedItemCount: countData.lineItemCount,
          actualItemCount: fixedItems.length,
          quoteStructure: countData.structure,
          quoteTotalAmount: countData.quoteTotalAmount,
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