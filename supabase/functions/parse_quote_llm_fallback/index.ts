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

    // STEP 1: Ask LLM to count and identify line items first
    const countingPrompt = `Analyze this construction quote document and identify ALL line items.

CRITICAL: This is a CHUNK of a larger document (${chunkInfo || 'unknown position'}).
Count EVERY line item in this chunk, even if tables continue across pages.

TASK: Count how many actual billable line items exist in THIS CHUNK (NOT including subtotals, headers, footers).

RULES FOR COUNTING:
1. Line items MUST have: description, quantity, unit, rate, and total
2. DO NOT count ANY lines containing these keywords:
   - "subtotal", "sub-total", "sub total"
   - "total", "totals", "grand total", "section total", "page total"
   - "carried forward", "brought forward", "c/f", "b/f"
   - "contingency", "allowance", "provisional sum"
   - "summary", "sum of", "cumulative"
3. DO NOT count section headers or category headers (even if they have amounts)
4. DO NOT count page numbers, footers, or notes
5. DO NOT count empty rows or placeholder rows
6. If a line describes a summary of other lines below it, DO NOT count it
7. Count ALL detailed billable items in this chunk - look carefully for multi-page tables

IMPORTANT FOR CHUNKED DOCUMENTS:
- Tables may span across pages within this chunk
- Look for table continuations (same column structure on multiple pages)
- Count items from ALL pages in this chunk
- If you see "continued" or page breaks, keep counting items after the break

EXAMPLES OF WHAT TO EXCLUDE:
- "Subtotal for Section A: $10,000" ❌ (this is a summary)
- "Total Fire Protection: $50,000" ❌ (this is a summary)
- "Grand Total: $100,000" ❌ (this is a summary)
- "Contingency 10%: $5,000" ❌ (contingencies are not line items)
- "Section 1 - Fire Collars" ❌ (section header with no qty/unit/rate)

EXAMPLES OF WHAT TO INCLUDE:
- "Fire Collar Type A - 100mm diameter, Qty: 50, Rate: $125, Total: $6,250" ✓
- "Intumescent Seal 3m length, Qty: 100, Rate: $45, Total: $4,500" ✓
- "Installation Service, Qty: 1, Rate: $2,500, Total: $2,500" ✓

OUTPUT FORMAT (JSON only):
{
  "lineItemCount": number,
  "quoteTotalAmount": number,
  "structure": "detailed" | "two-tier" | "lump-sum-only",
  "notes": "brief explanation - mention if tables span multiple pages"
}

DOCUMENT CHUNK:
${text}

Count ALL line items in this chunk across all pages shown.`;

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

    // STEP 2: Extract EXACTLY that many line items
    const systemPrompt = `You are an expert at parsing construction quotes.

CRITICAL: This chunk has EXACTLY ${countData.lineItemCount} billable line items.
Extract ALL ${countData.lineItemCount} items - do not miss any items.

DOCUMENT STRUCTURE: ${countData.structure}
${countData.notes ? `NOTES: ${countData.notes}` : ''}

IMPORTANT: This is a CHUNK (${chunkInfo || 'unknown position'}) of a larger document.
- Tables may continue across multiple pages within this chunk
- Extract items from ALL pages in the chunk
- Don't stop at page breaks - keep extracting if the table continues

DO NOT EXTRACT (THESE ARE NOT LINE ITEMS):
1. Any row containing: "subtotal", "sub-total", "sub total", "total", "totals"
2. Any row containing: "grand total", "section total", "page total", "summary"
3. Any row containing: "carried forward", "brought forward", "c/f", "b/f"
4. Any row containing: "contingency", "allowance", "provisional sum"
5. Section headers or category headers (even if they have dollar amounts)
6. Table headers (e.g., "Description", "Qty", "Rate", "Amount")
7. Page numbers, footers, notes, legal terms
8. Empty or placeholder rows
9. Summary rows that add up other line items

${countData.structure === 'two-tier' ? `
TWO-TIER DETECTION:
This quote has category lump sums AND detailed items.
- Extract ONLY the category lump sums (e.g., "Collar", "Seal", "Insulation")
- SKIP all detailed breakdowns (e.g., "PVC Pipe 100mm", "Cable Bundle 2x GIB")
` : ''}

EXTRACT ONLY:
- Individual billable line items (NOT their summaries)
- Each item MUST have all five fields: description, qty, unit, rate, total
- If a row looks like a summary of other rows, SKIP IT
- If a row contains summary keywords (total, subtotal, summary), SKIP IT
- Stop after exactly ${countData.lineItemCount} items

CRITICAL QUANTITY RULES:
- Extract qty ONLY from the "Quantity" or "Qty" column
- Quantities MUST be whole numbers (integers): 1, 2, 5, 100, 500, etc.
- NEVER use decimal quantities: 5.2, 5.4, 3.7 are NOT valid quantities
- If you see a decimal number, it's likely a page reference or section number - SKIP IT
- If the quantity column is blank or shows "1 Sum" or "1 Lump", use qty=1

CRITICAL RATE CALCULATION:
- If the document shows ONLY a total (no separate rate): rate = total / qty
- If the document shows qty, rate, AND total: extract all three as shown
- NEVER put the total amount in the rate field
- Example: "Collar  1  $540,242" should be: qty=1, rate=$540242, total=$540242
- Example: "Cable Bundle  2  $228,344" should be: qty=2, rate=$114172, total=$228344

COLUMN IDENTIFICATION:
Look for columns labeled: "Description", "Qty" or "Quantity", "Unit", "Rate" or "Unit Price", "Total" or "Amount"
Extract values from the CORRECT columns - don't mix up page numbers with quantities!

OUTPUT FORMAT (JSON only):
{
  "items": [{"description": "string", "qty": number, "unit": "string", "rate": number, "total": number, "section": "string"}],
  "confidence": number,
  "warnings": ["string"]
}`;

    const userPrompt = `Extract EXACTLY ${countData.lineItemCount} line items from this quote:

${text}

${supplierName ? `Supplier: ${supplierName}` : ''}

Extract exactly ${countData.lineItemCount} items. Return JSON.`;

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
      /\b(grand[-\s]?total|section[-\s]?total|block[-\s]?total)\b/i,
      /\b(page[-\s]?total|cumulative|summary)\b/i,
      /\b(sum[-\s]?of|total[-\s]?for)\b/i,
      /^total$/i,
      /^totals$/i,
      /\btotal\s*:\s*\$/i,
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