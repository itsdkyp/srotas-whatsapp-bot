import axios from 'axios';

export const BASE_URL = process.env.WHATSAPP_BOT_API_URL || 'http://localhost:3000';

const http = axios.create({
    baseURL: `${BASE_URL}/api`,
    timeout: 20000,
});

function friendlyError(err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ECONNRESET') {
        return new Error(
            `Could not reach the Srotas WhatsApp Bot server at ${BASE_URL}. ` +
            `Make sure the app is running (desktop app open, or "npm run dev" in the project root), ` +
            `and that the license is activated before using these tools.`
        );
    }
    if (err.response) {
        const apiMessage = err.response.data && err.response.data.error;
        return new Error(apiMessage || `Request failed with status ${err.response.status}`);
    }
    return err;
}

export async function apiGet(path, params) {
    try {
        const res = await http.get(path, { params });
        return res.data;
    } catch (err) {
        throw friendlyError(err);
    }
}

export async function apiPost(path, data) {
    try {
        const res = await http.post(path, data);
        return res.data;
    } catch (err) {
        throw friendlyError(err);
    }
}

export async function apiPut(path, data) {
    try {
        const res = await http.put(path, data);
        return res.data;
    } catch (err) {
        throw friendlyError(err);
    }
}

export async function apiDelete(path) {
    try {
        const res = await http.delete(path);
        return res.data;
    } catch (err) {
        throw friendlyError(err);
    }
}

export async function apiPostForm(path, form) {
    try {
        const res = await http.post(path, form, {
            headers: form.getHeaders(),
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
        });
        return res.data;
    } catch (err) {
        throw friendlyError(err);
    }
}
