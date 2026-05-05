export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { base64, mediaType, rubro } = req.body;

  const systemPrompt = `Sos un asistente contable especializado en facturas argentinas. Respondé ÚNICAMENTE con un JSON válido sin texto adicional ni markdown. Claves requeridas:
{"fecha":"DD/MM/YYYY","tipo":"Fact A|Fact B|Fact C","pto_venta":"string","nro_comprobante":"string","cuit":"string sin guiones","proveedor":"nombre","gravado":number|null,"no_gravado":number|null,"iva_21":number|null,"iva_105":number|null,"iva_27":number|null,"percep_iva":number|null,"percep_iibb_bsas":number|null,"percep_iibb_caba":number|null,"total":number,"rubro":"string|null"}
Números sin formato, null si no aparece.`;

  const isImage = mediaType.startsWith('image/');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: 'user', content: [
        { type: isImage ? 'image' : 'document', source: { type: 'base64', media_type: mediaType, data: base64 } },
        { type: 'text', text: `Extraé los datos.${rubro ? ' Rubro: ' + rubro : ''}` }
      ]}]
    })
  });

  const data = await response.json();
  const text = data.content?.filter(b => b.type === 'text').map(b => b.text).join('') || '';
  const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
  if (rubro && !parsed.rubro) parsed.rubro = rubro;
  res.status(200).json(parsed);
}
