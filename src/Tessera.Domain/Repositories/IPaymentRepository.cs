using Tessera.Domain.Entities;

namespace Tessera.Domain.Repositories;

public interface IPaymentRepository : IRepository<Payment>
{
    Task<IEnumerable<Payment>> GetByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default);
    Task<Payment?> GetByBookingIdAsync(Guid bookingId, CancellationToken cancellationToken = default);
}
