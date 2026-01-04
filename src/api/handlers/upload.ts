import { createWorker } from "npm:tesseract.js";
import { parseNutritionText } from "../../utils/nutritionParser.ts";

export async function handleUploadRoutes(req: Request, url: URL, headers: Headers): Promise<Response> {
    const method = req.method;

    // POST /api/upload-temp
    if (url.pathname === "/api/upload-temp" && method === "POST") {
        try {
            const formData = await req.formData();
            const file = formData.get("file") as File;

            if (!file) {
                return new Response(JSON.stringify({ error: "No file uploaded" }), { status: 400, headers });
            }

            const ext = (file.name.split('.').pop() || "").toLowerCase();
            const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'avif'];

            if (!allowedExts.includes(ext)) {
                return new Response(JSON.stringify({ error: "Invalid file type. Only images allowed." }), { status: 400, headers });
            }

            const uuid = crypto.randomUUID();
            const filename = `${uuid}.${ext}`;
            const uploadPath = `uploads/temp/${filename}`;

            await Deno.writeFile(uploadPath, file.stream());

            return new Response(JSON.stringify({ tempUrl: uploadPath }), { headers });

        } catch (e) {
            console.error("Upload error:", e);
            return new Response(JSON.stringify({ error: "Upload failed" }), { status: 500, headers });
        }
    }

    // POST /api/parse-image
    if (url.pathname === "/api/parse-image" && method === "POST") {
        try {
            const body = await req.json();
            const { tempUrl } = body;

            if (!tempUrl || !tempUrl.startsWith("uploads/temp/")) {
                return new Response(JSON.stringify({ error: "Invalid temp URL" }), { status: 400, headers });
            }

            // Verify file exists
            try {
                await Deno.stat(tempUrl);
            } catch {
                 return new Response(JSON.stringify({ error: "File not found" }), { status: 404, headers });
            }

            // Read file buffer
            const fileData = await Deno.readFile(tempUrl);

            // Run Tesseract
            console.log(`[OCR] Starting recognition for ${tempUrl}`);
            const worker = await createWorker("swe");
            const ret = await worker.recognize(fileData);
            await worker.terminate();

            const text = ret.data.text;
            console.log(`[OCR] Recognition complete. Text length: ${text.length}`);

            const parsed = parseNutritionText(text);

            return new Response(JSON.stringify({
                text,
                parsed
            }), { headers });

        } catch (e) {
             console.error("OCR error:", e);
             return new Response(JSON.stringify({ error: "OCR failed: " + (e instanceof Error ? e.message : String(e)) }), { status: 500, headers });
        }
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers });
}
