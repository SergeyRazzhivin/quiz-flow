import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@shared/config/env'

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
