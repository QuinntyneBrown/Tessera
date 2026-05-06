using Microsoft.EntityFrameworkCore;
using Tessera.Domain.Repositories;

namespace Tessera.Infrastructure.Persistence.Repositories;

public class Repository<T>(TesseraDbContext context) : IRepository<T> where T : class
{
    protected readonly TesseraDbContext Context = context;
    private readonly DbSet<T> _dbSet = context.Set<T>();

    public async Task<T?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        => await _dbSet.FindAsync([id], cancellationToken);

    public async Task<IEnumerable<T>> GetAllAsync(CancellationToken cancellationToken = default)
        => await _dbSet.ToListAsync(cancellationToken);

    public void Add(T entity) => _dbSet.Add(entity);
    public void Update(T entity) => _dbSet.Update(entity);
    public void Remove(T entity) => _dbSet.Remove(entity);
}
