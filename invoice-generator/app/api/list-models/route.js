import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GOOGLE_API_KEY manquant dans .env.local (invoice-generator/.env.local)' },
        { status: 400 }
      );
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        {
          error: `Impossible de lister les modèles (HTTP ${res.status}).`,
          details: text,
          hint:
            'Vérifiez que la clé provient de Google AI Studio (aistudio.google.com) et que l’API Generative Language est activée.',
        },
        { status: res.status }
      );
    }

    const data = await res.json();
    const models = (data.models || []).map((m) => ({
      name: m.name,
      displayName: m.displayName || null,
      description: m.description || null,
      supportedMethods: m.supportedGenerationMethods || m.supportedMethods || null,
    }));

    return NextResponse.json({ success: true, models });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Erreur interne lors de la récupération des modèles',
        details: err?.message || String(err),
      },
      { status: 500 }
    );
  }
}