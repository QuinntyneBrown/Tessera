using Microsoft.EntityFrameworkCore;
using Tessera.Domain.Entities;
using Tessera.Domain.Repositories;

namespace Tessera.Infrastructure.Persistence.Repositories;

public class ParticipantRepository(TesseraDbContext context) : Repository<Participant>(context), IParticipantRepository
{
    public async Task<IEnumerable<Participant>> GetByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default)
        => await Context.Participants.Where(p => p.TenantId == tenantId && p.IsActive).ToListAsync(cancellationToken);

    public async Task<Participant?> GetByEmailAsync(Guid tenantId, string email, CancellationToken cancellationToken = default)
        => await Context.Participants.FirstOrDefaultAsync(p => p.TenantId == tenantId && p.Email == email, cancellationToken);
}
