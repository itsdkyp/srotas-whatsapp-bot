const fs = require('fs');
const path = require('path');
const { settings: settingsDb } = require('../db/database');

const GENERATION_TIMEOUT_MS = 90000; // Image generation can take a while
const DEFAULT_IMAGE_MODEL = 'gemini-2.5-flash-image';

const LOGO_MIME_MAP = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
};

function getGeminiKey() {
    return settingsDb.get('gemini_api_key') || process.env.GEMINI_API_KEY || null;
}

/**
 * Image generation is offered only when a Gemini API key is configured.
 */
function isImageGenAvailable() {
    return !!getGeminiKey();
}

function getCompanyLogo() {
    const logoPath = settingsDb.get('company_logo_path');
    if (!logoPath || !fs.existsSync(logoPath)) return null;
    const mimeType = LOGO_MIME_MAP[path.extname(logoPath).toLowerCase()];
    if (!mimeType) return null;
    return {
        mimeType,
        data: fs.readFileSync(logoPath).toString('base64'),
    };
}

function buildPrompt(messageText, hasLogo) {
    let prompt =
        `You are a world-class commercial photographer and CGI director specializing in premium Indian brand campaigns. ` +
        `Your work appears in Forbes India, Vogue India, and campaigns for Tata, Mahindra, and Reliance.\n\n` +
        `CAMPAIGN MESSAGE:\n"${messageText}"\n\n` +
        `═══ COMPOSITION PRIORITY — READ THIS FIRST ═══\n` +
        `The PRIMARY SUBJECT of this image is the SERVICE, PRODUCT, or ENVIRONMENT described in the campaign message. ` +
        `NOT a person. The image must make the viewer immediately understand WHAT is being offered — the service or product must dominate the frame.\n` +
        `People (if any) are SECONDARY — they appear only in the background, periphery, or as a small supporting element to add human emotional context. ` +
        `A person should NEVER be the main focal point unless the message is explicitly about a person-centric service (e.g. personal coaching, beauty).\n\n` +
        `COMPOSITION EXAMPLES by message type:\n` +
        `- Electrical/infrastructure service → Hero shot of a gleaming transformer substation or high-voltage panel, with an engineer confidently visible in the background\n` +
        `- Food/restaurant → Hero close-up of the dish with bokeh background showing a warm dining scene\n` +
        `- Real estate → Dramatic architectural shot of the building exterior or a luxury interior, with a person subtly visible inside\n` +
        `- Technology/software → Premium device/screen showing the product in action, with a professional visible in the background\n` +
        `- Fashion/retail → Product as the clear hero, lifestyle context in the background\n\n` +
        `═══ ABSOLUTE STYLE MANDATE ═══\n` +
        `This image MUST be a photorealistic, high-resolution photograph indistinguishable from real life. ` +
        `Shot on Phase One XF IQ4 or Sony A1 — tack sharp subject, cinematic color grade, luxury brand campaign quality.\n\n` +
        `═══ PEOPLE (SECONDARY ROLE ONLY) ═══\n` +
        `- If people appear, they MUST be Indian (South Asian) — authentic features, skin tones from wheatish to deep brown\n` +
        `- They should look aspirational and professional — aged 25–45, modern premium attire\n` +
        `- Their role: provide human scale, warmth, or emotional context — they are NOT the subject\n` +
        `- Expressions: genuine, natural — NOT posed stock-photo smiles\n\n` +
        `═══ TYPOGRAPHY (IF INCLUDED) ═══\n` +
        `- ONLY: Helvetica Neue, Futura, Montserrat, or similar clean geometric sans-serif\n` +
        `- NO: serif, script, decorative, retro, or display fonts of any kind\n` +
        `- Maximum 5 words. Bold weight. White or dark charcoal only — no multicolor text\n\n` +
        `═══ FORBIDDEN — ANY = COMPLETE FAILURE ═══\n` +
        `- NO illustrations, drawings, paintings, sketches, or flat/2D design\n` +
        `- NO cartoon, anime, comic, or CGI-animated look\n` +
        `- NO watercolor, oil paint, or artistic filters\n` +
        `- NO people as the main subject (unless the message is person-centric)\n` +
        `- NO non-Indian people if people appear\n` +
        `═══ STEP 1 — DECIDE THE FORMAT (do this first) ═══\n` +
        `Read the campaign message carefully and choose ONE of the two formats below based on its content and intent:\n\n` +
        `FORMAT A — POSTER\n` +
        `Choose this when the message is about: a SALE, DISCOUNT, LIMITED OFFER, EVENT, LAUNCH, ANNOUNCEMENT, DEADLINE, or URGENCY.\n` +
        `Signals: words like "off", "sale", "offer", "ends", "launch", "new", "limited", "hurry", "today only", "introducing", "event", "%"\n` +
        `→ A poster uses BOLD TEXT as a primary design element, dramatic background, strong color contrast, and typographic hierarchy to grab instant attention.\n\n` +
        `FORMAT B — GENERAL PROMOTIONAL\n` +
        `Choose this when the message is about: a SERVICE, PRODUCT SHOWCASE, BRAND AWARENESS, TRUST-BUILDING, or GENERAL INFORMATION.\n` +
        `Signals: describing what a company does, features, reliability, expertise, quality, "we provide", "our services", "contact us"\n` +
        `→ A general promo uses a photorealistic scene where the SERVICE or PRODUCT is the visual hero. Minimal or no text overlay.\n\n` +
        `═══ STEP 2 — EXECUTE THE CHOSEN FORMAT ═══\n\n` +
        `IF FORMAT A (POSTER):\n` +
        `- Layout: Dramatic full-bleed background (real photographic or cinematic CGI scene related to the service/product)\n` +
        `- Text hierarchy: 1 massive headline (the core offer, max 4 words) + 1 supporting subline (max 6 words) — positioned with strong visual weight\n` +
        `- Typography: ONLY clean geometric sans-serif — Helvetica Neue, Futura, or Montserrat. Bold/Black weight. NO serif, script, retro, or decorative fonts\n` +
        `- Colors: High contrast — white or bright accent text on dark dramatic background, OR dark text on vivid light background\n` +
        `- Feel: Stops the scroll instantly. Every square centimeter is intentional. Premium Indian brand poster quality.\n` +
        `- People: Optional — small supporting role only, or no people at all if the service/product can stand alone\n\n` +
        `IF FORMAT B (GENERAL PROMOTIONAL):\n` +
        `- Layout: The SERVICE, PRODUCT, or ENVIRONMENT is the dominant visual hero — fills the frame with drama and clarity\n` +
        `- Text: Minimal or none — at most a 3–5 word label if it strongly reinforces the visual\n` +
        `- Photography style: Shot on Phase One XF IQ4 — tack sharp subject, shallow depth of field (bokeh), cinematic color grade\n` +
        `- People: Secondary role only — in background or periphery to add human warmth. NEVER the primary subject\n` +
        `- Feel: Editorial. Premium. As if from a luxury brand campaign shoot.\n\n` +
        `═══ RULES THAT APPLY TO BOTH FORMATS ═══\n\n` +
        `PHOTOREALISM (mandatory):\n` +
        `- This image MUST look like a real photograph or high-end CGI render — indistinguishable from real life\n` +
        `- NO illustrations, drawings, paintings, sketches, flat/2D design, vector art, cartoon, anime, watercolor, or oil paint style\n` +
        `- NO generic stock-photo look — must feel premium and editorial\n\n` +
        `PEOPLE (if included):\n` +
        `- MUST be Indian (South Asian) — authentic facial features, skin tones from wheatish to deep brown\n` +
        `- Aspirational and professional — aged 25–45, modern premium attire\n` +
        `- Genuine natural expressions — NOT posed stock-photo smiles\n` +
        `- Settings: modern Indian premium environments (Bangalore/Mumbai offices, luxury interiors, smart city spaces)\n\n` +
        `TYPOGRAPHY:\n` +
        `- ONLY: Helvetica Neue, Futura, Montserrat, or equivalent clean geometric sans-serif\n` +
        `- ABSOLUTELY FORBIDDEN: serif, script, decorative, retro, handwritten, or display fonts\n` +
        `- White/off-white on dark backgrounds, dark charcoal on light — never garish multicolor text\n\n` +
        `FORMAT: Square (1:1). Clean composition. Single dominant focal point. No clutter.\n` +
        `NO INVENTED BRANDING: Do NOT add logos, icons, watermarks, or symbols not explicitly provided.`;

    if (hasLogo) {
        prompt +=
            `\n\nLOGO (STRICT — applies to both formats):\n` +
            `- The attached image is the ONLY permitted logo in this image\n` +
            `- For POSTER: place it as a clean corner element (bottom-right or top-left), small but legible, semi-transparent\n` +
            `- For GENERAL PROMO: embed it naturally in the scene — on signage, product surface, glass door, laptop screen, or business card\n` +
            `- Must look physically part of the image, NOT pasted or overlaid\n` +
            `- Do NOT alter, redraw, or simplify the logo design\n` +
            `- Do NOT add any other logo or brand mark`;
    } else {
        prompt += `\n\nNO LOGO: No logo provided. Do NOT invent or display any logo, brand mark, or icon anywhere in the image.`;
    }

    return prompt;
}

/**
 * Generate a campaign image from the message text using Gemini image generation.
 * If a company logo is configured in settings, it is passed to the model to be
 * composited into the design.
 * Returns { data: <base64>, mimeType }.
 */
async function generateCampaignImage(messageText) {
    const key = getGeminiKey();
    if (!key) throw new Error('Gemini API key not configured');

    const model = settingsDb.get('ai_image_model') || DEFAULT_IMAGE_MODEL;
    const logo = getCompanyLogo();

    // Use custom prompt from settings if set, otherwise use the auto-generated one
    const customPrompt = settingsDb.get('image_generation_prompt');
    let finalPrompt;
    if (customPrompt && customPrompt.trim().length > 20) {
        // Inject the campaign message into the custom prompt
        finalPrompt = customPrompt.replace(/\{\{message\}\}/gi, messageText);
        // If the user didn't include {{message}}, append the message at the top
        if (!/\{\{message\}\}/i.test(customPrompt)) {
            finalPrompt = `CAMPAIGN MESSAGE:\n"${messageText}"\n\n${customPrompt}`;
        }
        // Append logo instruction if logo exists
        if (logo) {
            finalPrompt +=
                `\n\nLOGO (STRICT): The attached image is the ONLY permitted logo in this image.\n` +
                `- Place it naturally in the scene — on signage, a product surface, glass door, screen, or business card\n` +
                `- Must look physically embedded in the scene, NOT pasted or overlaid\n` +
                `- Blend semi-transparently where it meets the background\n` +
                `- Do NOT alter, redraw, or simplify the logo in any way`;
        }
    } else {
        finalPrompt = buildPrompt(messageText, !!logo);
    }

    const parts = [{ text: finalPrompt }];
    if (logo) parts.push({ inlineData: { mimeType: logo.mimeType, data: logo.data } });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);

    let response;
    try {
        response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': key,
                },
                body: JSON.stringify({
                    contents: [{ parts }],
                    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
                }),
                signal: controller.signal,
            }
        );
    } catch (e) {
        if (e.name === 'AbortError') throw new Error('Image generation timed out after 90s');
        throw new Error(`Image generation request failed: ${e.message}`);
    } finally {
        clearTimeout(timer);
    }

    if (!response.ok) {
        let detail = `HTTP ${response.status}`;
        try {
            const errBody = await response.json();
            detail = errBody?.error?.message || detail;
        } catch (_) { }
        throw new Error(`Gemini image generation failed: ${detail}`);
    }

    const body = await response.json();
    const candidateParts = body?.candidates?.[0]?.content?.parts || [];
    const imagePart = candidateParts.find(p => p.inlineData?.data);
    if (!imagePart) {
        const textPart = candidateParts.find(p => p.text);
        const reason = body?.candidates?.[0]?.finishReason;
        throw new Error(
            `Gemini did not return an image${reason ? ` (${reason})` : ''}`
            + (textPart ? `: ${textPart.text.substring(0, 200)}` : '')
        );
    }

    return {
        data: imagePart.inlineData.data,
        mimeType: imagePart.inlineData.mimeType || 'image/png',
    };
}

module.exports = { isImageGenAvailable, generateCampaignImage };
