/**
 * DriveCodex — Edge Function: manual-text
 *
 * Returns full extracted text for a workshop manual section.
 * Lightweight endpoint — just queries Supabase table, no Neo4j needed.
 *
 * POST body:
 *   section_id:  string   "1,9_TDI_77kW_BKC_BXE_BLS_RG19"
 *
 * OR:
 *   manual:      string   "1,9_TDI_77kW_BKC_BXE_BLS.pdf"
 *   section:     string   "Cooling"
 */

import { optionsResponse } from '../_shared/cors.ts'
import { json } from '../_shared/response.ts'
import { getAuthUser } from '../_shared/auth.ts'
import { getServiceClient } from '../_shared/client.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  const user = await getAuthUser(req)
  if (!user) return json({ error: 'Unauthorized' }, 401)

  try {
    const body = await req.json()
    const client = getServiceClient()

    let query = client
      .from('manual_section_text')
      .select('id, manual_filename, section_title, repair_group, pdf_page, page_count, extracted_pages, content, char_count')

    if (body.section_id) {
      // Direct ID lookup (fastest)
      query = query.eq('id', body.section_id)
    } else if (body.manual && body.section) {
      // Lookup by manual filename + section title
      query = query
        .eq('manual_filename', body.manual)
        .eq('section_title', body.section)
    } else {
      return json({ error: 'Provide section_id or manual + section' }, 400)
    }

    const { data, error } = await query.limit(1).single()

    if (error || !data) {
      return json({ error: 'Section not found', detail: error?.message }, 404)
    }

    return json({
      id: data.id,
      manual: data.manual_filename,
      section: data.section_title,
      repair_group: data.repair_group,
      pdf_page: data.pdf_page,
      page_count: data.page_count,
      extracted_pages: data.extracted_pages,
      content: data.content,
      char_count: data.char_count,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('manual-text error:', msg)
    return json({ error: msg }, 500)
  }
})
