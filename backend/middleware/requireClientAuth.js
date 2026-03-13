import { getSupabaseServiceClient } from '../supabase.js';
import { impersonationTokens } from '../routes/client-portal.js';

export default async function requireClientAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Token não fornecido' });
    }

    const token = authHeader.split(' ')[1];

    // Check impersonation tokens first
    const impersonation = impersonationTokens.get(token);
    if (impersonation) {
      if (impersonation.expiresAt < Date.now()) {
        impersonationTokens.delete(token);
        return res.status(401).json({ success: false, error: 'Token de impersonação expirado' });
      }
      req.clientUser = {
        ...impersonation.contact,
        isImpersonation: true,
        isCompanyImpersonation: !!impersonation.contact.isCompanyImpersonation,
        impersonatedBy: impersonation.createdBy,
      };
      return next();
    }

    // Validate JWT via Supabase (reuse singleton service client)
    const supabase = getSupabaseServiceClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ success: false, error: 'Token inválido' });
    }

    // Find contact by supabase_auth_id with portal access
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('id, name, email, phone, position, company_id, companies(id, name)')
      .eq('supabase_auth_id', user.id)
      .eq('has_portal_access', true)
      .single();

    if (contactError || !contact) {
      return res.status(403).json({ success: false, error: 'Acesso ao portal não autorizado' });
    }

    // Attach client user to request (NOT req.user - complete isolation)
    req.clientUser = {
      id: contact.id,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      position: contact.position,
      companyId: contact.company_id,
      companyName: contact.companies?.name || null,
      supabaseUserId: user.id,
    };

    next();
  } catch (err) {
    console.error('Client auth error:', err);
    return res.status(500).json({ success: false, error: 'Erro de autenticação' });
  }
}
