using Tessera.Domain.Repositories;

namespace Tessera.Infrastructure.Persistence;

public class UnitOfWork(TesseraDbContext context) : IUnitOfWork
{
    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        => context.SaveChangesAsync(cancellationToken);
}
