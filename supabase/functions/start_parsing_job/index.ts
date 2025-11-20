import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { projectId, supplierName, fileName, fileUrl, organisationId, userId } = await req.json();

    if (!projectId || !supplierName || !fileName || !fileUrl || !organisationId || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    console.log("Creating parsing job:", { projectId, supplierName, fileName });

    const { data: job, error: jobError } = await supabase
      .from("parsing_jobs")
      .insert({
        project_id: projectId,
        supplier_name: supplierName,
        file_name: fileName,
        file_url: fileUrl,
        organisation_id: organisationId,
        user_id: userId,
        status: "pending",
        progress: 0,
      })
      .select()
      .single();

    if (jobError || !job) {
      console.error("Failed to create parsing job:", jobError);
      throw new Error(`Failed to create parsing job: ${jobError?.message}`);
    }

    console.log("Parsing job created:", job.id);

    const processUrl = `${supabaseUrl}/functions/v1/process_parsing_job`;
    console.log("Triggering process_parsing_job at:", processUrl);

    fetch(processUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ jobId: job.id }),
    }).catch(err => {
      console.error("Failed to trigger process_parsing_job:", err);
    });

    return new Response(
      JSON.stringify({
        success: true,
        jobId: job.id,
        message: "Parsing job started successfully"
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
    console.error("Error starting parsing job:", error);
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
