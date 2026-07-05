const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const url = process.env.NEXT_PUBLIC_SUPABASE_URL

for (const table of ['custom_invoices', 'invoice_settings', 'hotel_vouchers', 'storage_usage', 'bookings']) {
  const res = await fetch(`${url}/rest/v1/${table}?select=id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  const body = res.ok ? 'OK' : await res.text()
  console.log(`${table}: ${res.status} ${body.slice(0, 120)}`)
}
