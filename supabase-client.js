(function () {
  const hasConfig = window.VFX_SUPABASE_URL &&
    !window.VFX_SUPABASE_URL.includes('YOUR-PROJECT-ID') &&
    window.VFX_SUPABASE_ANON_KEY &&
    !window.VFX_SUPABASE_ANON_KEY.includes('YOUR-ANON-KEY');

  window.vfxSupabase = {
    configured: Boolean(window.supabase && hasConfig),
    client: hasConfig && window.supabase
      ? window.supabase.createClient(window.VFX_SUPABASE_URL, window.VFX_SUPABASE_ANON_KEY)
      : null
  };

  window.requireVfxSupabase = function () {
    if (!window.vfxSupabase.configured) {
      throw new Error('Supabase is not configured. Update supabase-config.js first.');
    }
    return window.vfxSupabase.client;
  };
}());
