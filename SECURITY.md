# Security & HIPAA Compliance Guide

## ⚠️ CRITICAL HIPAA NOTICE

This application processes Protected Health Information (PHI). To be HIPAA compliant, you **MUST**:

### 1. OpenAI Business Associate Agreement (BAA)
- ✅ **Required**: Sign a BAA with OpenAI for Whisper API usage
- 📋 **How**: Upgrade to OpenAI API enterprise/business tier
- 🔗 **Info**: https://openai.com/enterprise-privacy
- ❌ **Warning**: Free tier is NOT HIPAA compliant

### 2. Supabase Security Configuration
- ✅ Enable encryption at rest
- ✅ Use strong password policies (configured)
- ✅ Enable Row Level Security (RLS) on all tables
- ✅ Regular security audits
- 📋 Consider Supabase Teams/Enterprise for enhanced security

### 3. Network Security
- ✅ Use HTTPS only (enforced)
- ⚠️ **TODO**: Restrict CORS to your domain only
- ✅ Rate limiting enabled (20 req/min per user)
- ✅ Input validation on all endpoints

### 4. Data Handling
- ✅ No PHI in console logs (production mode)
- ✅ Audit logging uses content hashing
- ✅ PHI scrubbing for external APIs
- ✅ Automatic session cleanup after 90 days
- ⚠️ **TODO**: Implement data retention policies per HIPAA

### 5. Access Controls
- ✅ Authentication required for all endpoints
- ✅ RLS policies enforce user data isolation
- ✅ Role-based access control (RBAC)
- ⚠️ **TODO**: Multi-factor authentication (MFA)

## Production Deployment Checklist

### Before Going Live:

#### 1. API Keys & Secrets
- [ ] Move all API keys to Supabase secrets (never in code)
- [ ] Rotate default passwords and API keys
- [ ] Sign OpenAI BAA (enterprise tier)
- [ ] Review all edge function secrets

#### 2. CORS Configuration
```typescript
// Update in all edge functions:
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://yourdomain.com', // NOT '*'
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

#### 3. Database Security
- [ ] Run `supabase db lint` and fix all warnings
- [ ] Verify RLS policies on all tables
- [ ] Enable real-time replication only for necessary tables
- [ ] Set up automated backups
- [ ] Configure point-in-time recovery (PITR)

#### 4. Monitoring & Logging
- [ ] Set up error tracking (e.g., Sentry)
- [ ] Configure audit log retention
- [ ] Enable database query monitoring
- [ ] Set up security alerts

#### 5. Testing
- [ ] Penetration testing
- [ ] Security audit by third party
- [ ] Load testing edge functions
- [ ] Test rate limiting and failover

#### 6. Documentation
- [ ] Privacy Policy (HIPAA-compliant)
- [ ] Terms of Service
- [ ] Data Processing Agreement (DPA)
- [ ] User consent forms
- [ ] Incident response plan

## Current Security Measures

### Implemented ✅
1. **Rate Limiting**: 20 requests/minute per user
2. **PHI Protection**: No transcripts in logs
3. **Audit Logging**: Hashed content tracking
4. **Input Validation**: File size (25MB max) and type checking
5. **Authentication**: Required for all operations
6. **RLS Policies**: User data isolation
7. **Password Strength**: Enabled (min 8 chars, breach detection)
8. **HTTPS**: Enforced for all connections

### Pending ⚠️
1. **OpenAI BAA**: Must be signed for production
2. **CORS Restriction**: Change '*' to specific domain
3. **MFA**: Implement for healthcare users
4. **Data Retention**: Automatic PHI deletion policy
5. **Breach Notification**: Automated incident response

## Incident Response

If you suspect a security breach:
1. Immediately notify your security team
2. Document the incident (time, scope, affected data)
3. Follow your organization's breach notification procedures
4. Contact affected users within 60 days (HIPAA requirement)
5. File breach report with HHS if >500 individuals affected

## Contact

For security issues, contact: [your-security-email@domain.com]

## References

- [HIPAA Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/index.html)
- [OpenAI Enterprise Privacy](https://openai.com/enterprise-privacy)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/platform/going-into-prod)
