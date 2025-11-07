'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Download, Loader2, AlertCircle } from 'lucide-react';

const InvoiceGeneratorChat = () => {
  const [messages, setMessages] = useState([
    { 
      type: 'bot', 
      content: '👋 Bonjour ! Je suis votre assistant de facturation intelligent.\n\n📸 Envoyez-moi une image de:\n• Une conversation (commande par message)\n• Une note manuscrite\n• Une capture d\'écran\n\nJe vais automatiquement extraire les informations et générer une facture PDF professionnelle pour vous!',
      timestamp: new Date()
    }
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const addMessage = (type, content) => {
    setMessages(prev => [...prev, { type, content, timestamp: new Date() }]);
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError('L\'image est trop grande. Veuillez utiliser une image de moins de 5MB.');
        return;
      }
      setError(null);
      setSelectedImage(file);
      addMessage('user', `📷 Image sélectionnée: ${file.name} (${(file.size / 1024).toFixed(0)} KB)`);
      processImage(file);
    } else {
      setError('Veuillez sélectionner un fichier image valide (JPG, PNG, etc.)');
    }
  };

  const processImage = async (file) => {
    setIsProcessing(true);
    setError(null);
    addMessage('bot', '🔍 Analyse de l\'image en cours...\n⏳ Cela peut prendre quelques secondes...');

    try {

      const base64 = await fileToBase64(file);
      const base64Data = base64.split(',')[1]; 
      
      const response = await fetch('/api/process-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          image: base64Data,
          mimeType: file.type 
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.details || result.error || 'Erreur inconnue');
      }

      addMessage('bot', `✅ Texte extrait avec succès !\n\n📝 **Texte détecté:**\n${result.extractedText.substring(0, 500)}${result.extractedText.length > 500 ? '...' : ''}`);

      setExtractedData(result.invoiceData);

      addMessage('bot', '✨ Analyse terminée ! Voici les informations détectées:');
      addMessage('bot', formatInvoiceData(result.invoiceData));
      addMessage('bot', '📄 Cliquez sur le bouton "Générer PDF" ci-dessous pour créer votre facture !');

    } catch (error) {
      console.error('Processing error:', error);
      const errorMessage = `❌ Erreur lors du traitement de l\'image.\n\n**Détails:** ${error.message}\n\n💡 **Suggestions:**\n• Vérifiez que l'image est claire et lisible\n• Assurez-vous que le texte est visible\n• Essayez avec une autre image\n• Vérifiez votre connexion internet`;
      addMessage('bot', errorMessage);
      setError(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  const formatInvoiceData = (data) => {
    const formatPrice = (price) => price.toFixed(2);
    
    return `
📋 **Facture N°:** ${data.invoiceNumber}
📅 **Date:** ${data.date}

👤 **Client:**
- Nom: ${data.customerName}
- Adresse: ${data.customerAddress}
${data.customerPhone !== 'N/A' ? `• Téléphone: ${data.customerPhone}` : ''}

🛍️ **Articles commandés:**
${data.items.map((item, idx) => `
${idx + 1}. ${item.description}
   • Quantité: ${item.quantity}
   • Prix unitaire: ${formatPrice(item.unitPrice)}€
   • Total: ${formatPrice(item.total)}€`).join('\n')}

💰 **Totaux:**
- Sous-total HT: ${formatPrice(data.subtotal)}€
- TVA (20%): ${formatPrice(data.tax)}€
- **Total TTC: ${formatPrice(data.total)}€**

🚚 **Livraison:** ${data.deliveryTime}
    `.trim();
  };

  const generatePDF = async () => {
    if (!extractedData) return;

    addMessage('bot', '📄 Génération du PDF en cours...');
    setIsProcessing(true);

    try {

      const { jsPDF } = await import('jspdf');
      
      const doc = new jsPDF();
      const data = extractedData;
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      
      const addWrappedText = (text, x, y, maxWidth, lineHeight = 7) => {
        const lines = doc.splitTextToSize(text, maxWidth);
        doc.text(lines, x, y);
        return y + (lines.length * lineHeight);
      };

      doc.setFillColor(41, 128, 185);
      doc.rect(0, 0, pageWidth, 40, 'F');
      
      doc.setFontSize(28);
      doc.setTextColor(255, 255, 255);
      doc.text('FACTURE', pageWidth / 2, 25, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(`N° de Facture: ${data.invoiceNumber}`, 20, 50);
      doc.text(`Date d'émission: ${data.date}`, 20, 57);
      
      doc.setDrawColor(41, 128, 185);
      doc.setLineWidth(0.5);
      doc.rect(20, 65, 170, 35);
      
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text('INFORMATIONS CLIENT', 25, 73);
      
      doc.setFont(undefined, 'normal');
      doc.setFontSize(10);
      let yPos = 80;
      yPos = addWrappedText(`Nom: ${data.customerName}`, 25, yPos, 160);
      yPos = addWrappedText(`Adresse: ${data.customerAddress}`, 25, yPos, 160);
      if (data.customerPhone !== 'N/A') {
        doc.text(`Téléphone: ${data.customerPhone}`, 25, yPos);
      }
      
      const tableTop = 110;
      doc.setFillColor(41, 128, 185);
      doc.rect(20, tableTop, 170, 10, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(10);
      doc.text('Description', 25, tableTop + 7);
      doc.text('Qté', 120, tableTop + 7);
      doc.text('P.U. (€)', 140, tableTop + 7);
      doc.text('Total (€)', 165, tableTop + 7);
      
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');
      let currentY = tableTop + 15;
      
      data.items.forEach((item, index) => {
        if (currentY > pageHeight - 60) { 
          doc.addPage();
          currentY = 20;
        }
        
        const descLines = doc.splitTextToSize(item.description, 85);
        doc.text(descLines, 25, currentY);
        doc.text(item.quantity.toString(), 125, currentY, { align: 'right' });
        doc.text(item.unitPrice.toFixed(2), 155, currentY, { align: 'right' });
        doc.text(item.total.toFixed(2), 180, currentY, { align: 'right' });
        
        currentY += Math.max(descLines.length * 5, 8);
        
        doc.setDrawColor(200, 200, 200);
        doc.line(20, currentY, 190, currentY);
        currentY += 5;
      });
      
      currentY += 5;
      doc.setFont(undefined, 'normal');
      doc.text('Sous-total HT:', 140, currentY);
      doc.text(`${data.subtotal.toFixed(2)}€`, 180, currentY, { align: 'right' });
      
      currentY += 7;
      doc.text('TVA (20%):', 140, currentY);
      doc.text(`${data.tax.toFixed(2)}€`, 180, currentY, { align: 'right' });
      
      currentY += 10;
      doc.setFont(undefined, 'bold');
      doc.setFontSize(12);
      doc.setFillColor(240, 240, 240);
      doc.rect(135, currentY - 6, 55, 10, 'F');
      doc.text('TOTAL TTC:', 140, currentY);
      doc.setTextColor(41, 128, 185);
      doc.text(`${data.total.toFixed(2)}€`, 180, currentY, { align: 'right' });
      
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');
      doc.setFontSize(10);
      currentY += 15;
      doc.text(`Délai de livraison: ${data.deliveryTime}`, 20, currentY);
      
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      const footerY = pageHeight - 20;
      doc.text('Merci pour votre confiance !', pageWidth / 2, footerY, { align: 'center' });
      doc.text('Document généré automatiquement par IA', pageWidth / 2, footerY + 5, { align: 'center' });
      
      const fileName = `Facture_${data.invoiceNumber}_${data.customerName.replace(/\s+/g, '_')}.pdf`;
      doc.save(fileName);
      
      addMessage('bot', `✅ Facture PDF générée avec succès !\n📥 Le fichier "${fileName}" a été téléchargé.`);
      
    } catch (error) {
      console.error('PDF generation error:', error);
      addMessage('bot', `❌ Erreur lors de la génération du PDF: ${error.message}`);
      setError(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <div className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-2.5 rounded-xl shadow-lg">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">Générateur de Factures IA</h1>
                <p className="text-sm text-gray-600">Propulsé par Google Gemini</p>
              </div>
            </div>
            {selectedImage && (
              <div className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                📎 {selectedImage.name}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-md ${
                  msg.type === 'user'
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white'
                    : 'bg-white text-gray-800 border border-gray-200'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                <p className={`text-xs mt-2 ${msg.type === 'user' ? 'text-blue-100' : 'text-gray-400'}`}>
                  {msg.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          
          {isProcessing && (
            <div className="flex justify-start animate-fade-in">
              <div className="bg-white rounded-2xl px-4 py-3 shadow-md border border-blue-200">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                  <p className="text-sm text-gray-600">Traitement en cours...</p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-start">
              <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 shadow-md max-w-[85%]">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">Erreur</p>
                    <p className="text-sm text-red-600 mt-1">{error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 shadow-2xl">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 flex-wrap">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl font-medium"
            >
              <Upload className="w-5 h-5" />
              <span>Télécharger Image</span>
            </button>

            {extractedData && !isProcessing && (
              <button
                onClick={generatePDF}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl font-medium"
              >
                <Download className="w-5 h-5" />
                <span>Générer PDF</span>
              </button>
            )}

            {extractedData && (
              <button
                onClick={() => {
                  setExtractedData(null);
                  setSelectedImage(null);
                  setError(null);
                  setMessages([messages[0]]);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-all font-medium text-sm"
              >
                Nouvelle Analyse
              </button>
            )}
          </div>

          <p className="text-xs text-gray-500 mt-3 text-center">
            💡 Formats acceptés: JPG, PNG, WEBP • Taille max: 5MB
          </p>
        </div>
      </div>
    </div>
  );
};

export default InvoiceGeneratorChat;