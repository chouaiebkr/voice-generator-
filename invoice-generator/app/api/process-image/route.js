import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
  const { image, mimeType } = await request.json();

    if (!process.env.GOOGLE_API_KEY) {
      throw new Error('GOOGLE_API_KEY is not set in environment variables');
    }

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

    
    const tryModel = async (name) => {
      console.log(`Trying Gemini model: ${name}`);
      const m = genAI.getGenerativeModel({ model: name });
      return await m.generateContent([
        imagePart,
        { text: prompt },
      ]);
    };

  console.log('Sending image to Gemini API...');

    const prompt = `Analyse cette image et extrait TOUTES les informations de commande ou de facture.

Recherche et extrait:
- Nom complet du client
- Adresse complète (rue, code postal, ville)
- Numéro de téléphone (si présent)
- Articles commandés avec détails (nom, quantité, couleurs, spécifications)
- Prix unitaire de chaque article
- Prix total
- Délai ou date de livraison
- Toute autre information pertinente pour une facture

IMPORTANT: Retourne ta réponse UNIQUEMENT en format JSON, sans markdown ni commentaires.
Format attendu:
{
  "customerName": "nom complet du client",
  "customerAddress": "adresse complète",
  "customerPhone": "téléphone ou N/A si absent",
  "items": [
    {
      "description": "description complète de l'article",
      "quantity": nombre_entier,
      "unitPrice": prix_en_euros,
      "details": "couleur, taille, ou autres détails"
    }
  ],
  "deliveryTime": "délai de livraison",
  "extractedText": "tout le texte brut que tu as lu dans l'image"
}

Sois précis et rigoureux dans l'extraction.`;

    const imagePart = {
      inlineData: {
        data: image,
        mimeType: mimeType || 'image/jpeg',
      },
    };

  let result;
    const forced = (process.env.GEMINI_MODEL || '').trim();
    
    const candidates = forced
      ? [forced]
      : [
          'gemini-1.5-flash',
          'gemini-1.5-pro',
          'gemini-pro-vision',
          'gemini-1.0-pro-vision',
        ];

    let lastErr;
    for (const candidate of candidates) {
      try {
        result = await tryModel(candidate);
        console.log(`Model succeeded: ${candidate}`);
        break;
      } catch (apiErr) {
        lastErr = apiErr;
        const message = apiErr?.message || '';
        console.warn(`Model ${candidate} failed: ${message}`);
        if (message.includes('404') || message.includes('not found') || message.includes('not supported')) {
          continue;
        }
        
        throw apiErr;
      }
    }
    if (!result) {
      
      const msg = lastErr?.message || 'Aucun modèle disponible pour votre clé/API.';
      throw new Error(
        `${msg}. Essayez d'activer la Generative Language API dans Google Cloud, vérifier la clé API, ou utiliser un projet avec accès aux modèles Gemini.`
      );
    }
    const responseText = result.response.text();

  console.log('Received response from Gemini');
  console.log('Gemini response:', responseText);

    
    let parsedData;
    
  let cleanedResponse = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    try {
      parsedData = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        
        parsedData = {
          customerName: "Client",
          customerAddress: "Adresse non trouvée",
          customerPhone: "N/A",
          items: [{
            description: "Article détecté",
            quantity: 1,
            unitPrice: 0,
            details: ""
          }],
          deliveryTime: "À confirmer",
          extractedText: responseText
        };
      }
    }

    
    if (!Array.isArray(parsedData.items)) {
      parsedData.items = [{
        description: "Article",
        quantity: 1,
        unitPrice: 0,
        details: ""
      }];
    }

    
    const items = parsedData.items.map(item => ({
      description: `${item.description}${item.details ? ' - ' + item.details : ''}`,
      quantity: parseInt(item.quantity) || 1,
      unitPrice: parseFloat(item.unitPrice) || 0,
      total: (parseInt(item.quantity) || 1) * (parseFloat(item.unitPrice) || 0)
    }));

    
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const tax = Math.round(subtotal * 0.2 * 100) / 100;
    const total = subtotal + tax;

    
    const invoiceData = {
      invoiceNumber: `INV-${Date.now().toString().slice(-8)}`,
      date: new Date().toLocaleDateString('fr-FR'),
      customerName: parsedData.customerName || 'Client',
      customerAddress: parsedData.customerAddress || 'Adresse non spécifiée',
      customerPhone: parsedData.customerPhone || 'N/A',
      items: items,
      deliveryTime: parsedData.deliveryTime || 'À confirmer',
      subtotal: subtotal,
      tax: tax,
      total: total
    };

    console.log('Invoice data prepared:', invoiceData);

    
    return NextResponse.json({
      success: true,
      extractedText: parsedData.extractedText || responseText,
      invoiceData: invoiceData
    });

  } catch (error) {
    console.error('Error processing image:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erreur lors du traitement de l\'image',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';