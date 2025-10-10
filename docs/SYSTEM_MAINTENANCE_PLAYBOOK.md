# System Maintenance Playbook
**Xorstack Health Model - Operations & Incident Response Guide**

Version: 1.0  
Last Updated: 2025-10-10

---

## 🎯 Purpose

This playbook provides step-by-step procedures for maintaining, troubleshooting, and recovering the Xorstack Health Model platform in production.

---

## 📋 Table of Contents

1. [Routine Maintenance](#routine-maintenance)
2. [Incident Response](#incident-response)
3. [Backup & Recovery](#backup-recovery)
4. [Performance Optimization](#performance-optimization)
5. [Security Procedures](#security-procedures)
6. [Escalation Matrix](#escalation-matrix)

---

## 🔧 Routine Maintenance

### Daily Tasks
- [x] Monitor system health dashboard
- [x] Review error logs for anomalies
- [x] Check AI function latency metrics
- [x] Verify backup completion status

### Weekly Tasks
- [x] Review user feedback submissions
- [x] Analyze performance trends
- [x] Update security patches (if available)
- [x] Audit database query performance

### Monthly Tasks
- [x] Review and archive old logs
- [x] Perform security vulnerability scan
- [x] Test disaster recovery procedures
- [x] Review and optimize database indexes

---

## 🚨 Incident Response

### Severity Levels

| Level | Description | Response Time | Example |
|-------|-------------|---------------|---------|
| P0 - Critical | Total system outage | < 15 min | Auth system down |
| P1 - High | Major feature broken | < 1 hour | AI functions failing |
| P2 - Medium | Degraded performance | < 4 hours | Slow page loads |
| P3 - Low | Minor issues | < 24 hours | UI glitch |

### Incident Response Procedure

#### 1. **Detection**
- Automated alerts via monitoring system
- User-reported issues via feedback widget
- Admin dashboard anomaly detection

#### 2. **Assessment** (5 minutes)
```bash
# Check system health
- Navigate to /admin dashboard
- Review last 100 AI logs for errors
- Check Edge Function status
- Verify database connectivity
```

#### 3. **Communication**
- Create incident ticket
- Notify stakeholders based on severity
- Post status update (for P0/P1)

#### 4. **Mitigation**
- Implement immediate workaround if available
- Scale resources if needed (via Lovable Cloud)
- Apply hotfix if cause identified

#### 5. **Resolution**
- Deploy permanent fix
- Verify fix in production
- Update documentation

#### 6. **Post-Mortem** (P0/P1 only)
- Root cause analysis
- Timeline of events
- Action items to prevent recurrence

---

## 💾 Backup & Recovery

### Automated Backups (Lovable Cloud)
- **Database**: Daily snapshots, 7-day retention
- **Storage Buckets**: Continuous replication
- **Configuration**: Version-controlled in Git

### Manual Backup Procedure
```sql
-- Export critical tables
COPY (SELECT * FROM sessions) TO '/tmp/sessions_backup.csv' CSV HEADER;
COPY (SELECT * FROM profiles) TO '/tmp/profiles_backup.csv' CSV HEADER;
COPY (SELECT * FROM user_feedback) TO '/tmp/feedback_backup.csv' CSV HEADER;
```

### Recovery Procedures

#### Database Restore
1. Navigate to Lovable Cloud dashboard
2. Select backup timestamp
3. Initiate restore operation
4. Verify data integrity post-restore

#### Edge Function Rollback
1. Access version history in Lovable Cloud
2. Select previous stable version
3. Deploy rollback
4. Test functionality

#### Storage Recovery
1. Check bucket versioning history
2. Restore specific files or entire bucket
3. Update references if needed

---

## ⚡ Performance Optimization

### Auto-Healing Mechanisms

#### Edge Function Auto-Retry
```typescript
// Implemented in all Edge Functions
const MAX_RETRIES = 3;
const BACKOFF_MS = [1000, 2000, 4000];

async function callWithRetry(fn, retries = 0) {
  try {
    return await fn();
  } catch (error) {
    if (retries < MAX_RETRIES) {
      await delay(BACKOFF_MS[retries]);
      return callWithRetry(fn, retries + 1);
    }
    throw error;
  }
}
```

#### Rate Limiting
- Client-side: 20 requests/minute (default)
- AI functions: 10 requests/minute
- Transcription: 5 requests/minute
- Exports: 3 requests/minute

### Performance Monitoring

#### Key Metrics to Watch
```sql
-- Slow queries (> 500ms)
SELECT query, avg_exec_time 
FROM pg_stat_statements 
WHERE avg_exec_time > 500 
ORDER BY avg_exec_time DESC;

-- AI function latency
SELECT function_name, 
       AVG(duration_ms) as avg_latency,
       PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95
FROM ai_logs 
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY function_name;
```

---

## 🔐 Security Procedures

### Regular Security Audits

#### Weekly Checks
- [ ] Review failed authentication attempts
- [ ] Check for unusual API usage patterns
- [ ] Verify RLS policies are active
- [ ] Scan for exposed secrets in logs

#### Monthly Security Tasks
- [ ] Update dependencies with security patches
- [ ] Review user roles and permissions
- [ ] Audit database access patterns
- [ ] Test authentication flows

### Incident-Specific Procedures

#### Suspected Data Breach
1. **Immediate**: Disable affected accounts
2. **Assess**: Review audit logs for unauthorized access
3. **Contain**: Rotate all API keys and secrets
4. **Notify**: Inform affected users (if PHI compromised)
5. **Remediate**: Patch vulnerability
6. **Document**: Create incident report

#### Credential Compromise
1. Force password reset for affected users
2. Invalidate all active sessions
3. Review access logs for suspicious activity
4. Enable additional verification (if not already active)

---

## 📞 Escalation Matrix

| Issue Type | First Contact | Escalation | Critical Contact |
|------------|---------------|------------|------------------|
| Platform Outage | On-call engineer | Tech lead | CTO |
| Security Breach | Security lead | CISO | Legal |
| Data Loss | Database admin | Backup specialist | CTO |
| AI System Failure | AI engineer | ML lead | CTO |

### Contact Information
- **On-call**: Set up in Lovable Cloud monitoring
- **Emergency**: Defined in incident management system
- **Support**: support@xorstackhealth.com (placeholder)

---

## 🔄 Versioned Deployments & Rollback

### Deployment Strategy
- **Preview Environment**: Auto-deploy on commit to main
- **Production**: Manual promote from preview
- **Rollback**: One-click revert to previous version

### Version Control
- All code changes tracked in Git
- Database migrations versioned
- Edge Functions versioned by Lovable Cloud

### Rollback Procedure
```bash
# Via Lovable Cloud UI
1. Navigate to Deployments
2. Select stable version
3. Click "Rollback to this version"
4. Confirm rollback
5. Verify functionality
```

---

## 🤖 Self-Check Cron Job

### Automated Health Checks
```typescript
// Runs every 5 minutes
async function systemHealthCheck() {
  const checks = {
    auth: await checkAuth(),
    database: await checkDatabase(),
    edgeFunctions: await checkEdgeFunctions(),
    storage: await checkStorage(),
  };

  if (Object.values(checks).some(c => !c.healthy)) {
    await sendAlert(checks);
  }

  await logHealthStatus(checks);
}
```

### Alert Thresholds
- Auth API: > 2% error rate
- Database: > 100ms avg query time
- Edge Functions: > 1s avg latency
- Storage: > 80% quota used

---

## ✅ Maintenance Checklist Template

### Pre-Maintenance
- [ ] Notify users of planned downtime (if applicable)
- [ ] Create backup of current state
- [ ] Test changes in preview environment
- [ ] Prepare rollback plan

### During Maintenance
- [ ] Monitor system metrics continuously
- [ ] Document all changes made
- [ ] Test each change incrementally
- [ ] Keep communication channels open

### Post-Maintenance
- [ ] Verify all systems operational
- [ ] Review error logs for new issues
- [ ] Update documentation
- [ ] Send completion notification
- [ ] Schedule post-mortem (if issues occurred)

---

**Status**: ✅ **Maintenance Procedures Documented & Ready**

*This playbook is a living document and should be updated as systems evolve.*
