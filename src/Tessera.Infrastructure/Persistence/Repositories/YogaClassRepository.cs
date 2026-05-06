using Microsoft.EntityFrameworkCore;
using Tessera.Domain.Entities;
using Tessera.Domain.Repositories;

namespace Tessera.Infrastructure.Persistence.Repositories;

public class YogaClassRepository(TesseraDbContext context) : Repository<YogaClass>(context), IYogaClassRepository
{
    public async Task<IEnumerable<YogaClass>> GetByStudioIdAsync(Guid studioId, CancellationToken cancellationToken = default)
        => await Context.YogaClasses.Where(y => y.StudioId == studioId && y.IsActive).ToListAsync(cancellationToken);

    public async Task<IEnumerable<YogaClass>> GetByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default)
        => await Context.YogaClasses.Where(y => y.TenantId == tenantId && y.IsActive).ToListAsync(cancellationToken);
}
