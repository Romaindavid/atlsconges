// Envoi d'e-mails via l'API Resend (https://resend.com).
// Nécessite les variables d'environnement RESEND_API_KEY et RESEND_FROM_EMAIL.
// Si elles ne sont pas configurées, l'envoi est simplement ignoré (log console)
// pour ne jamais faire échouer l'action appelante.

export async function envoyerEmail(params: {
  to: string
  subject: string
  html: string
}): Promise<{ success: boolean; message?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL

  if (!apiKey || !from) {
    console.warn('Envoi email ignoré : RESEND_API_KEY ou RESEND_FROM_EMAIL manquant.')
    return { success: false, message: 'Email non configuré.' }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: params.subject,
        html: params.html,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('Erreur envoi email Resend:', res.status, body)
      return { success: false, message: 'Erreur envoi email.' }
    }
    console.log('Email envoyé à', params.to, '—', params.subject)
    return { success: true }
  } catch (err) {
    console.error('Erreur envoi email:', err)
    return { success: false, message: 'Erreur envoi email.' }
  }
}
