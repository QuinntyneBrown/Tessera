using Microsoft.EntityFrameworkCore;
using Tessera.Domain.Entities;
using Tessera.Domain.Repositories;

namespace Tessera.Infrastructure.Persistence.Repositories;

public class ClassSessionRepository(TesseraDbContext context) : Repository<ClassSession>(context), IClassSessionRepository
{
    public async Task<IEnumerable<ClassSession>> GetByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default)
        => await Context.ClassSessions.Where(s => s.TenantId == tenantId).ToListAsync(cancellationToken);

    public async Task<IEnumerable<ClassSession>> GetUpcomingByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default)
        => await Context.ClassSessions
            .Where(s => s.TenantId == tenantId && s.ScheduledAt > DateTime.UtcNow && s.Status == SessionStatus.Scheduled)
            .OrderBy(s => s.ScheduledAt)
            .ToListAsync(cancellationToken);
}
