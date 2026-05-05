using Microsoft.EntityFrameworkCore;
using Tessera.Domain.Entities;
using Tessera.Domain.Repositories;

namespace Tessera.Infrastructure.Persistence.Repositories;

public class PaymentRepository(TesseraDbContext context) : Repository<Payment>(context), IPaymentRepository
{
    public async Task<IEnumerable<Payment>> GetByTenantIdAsync(Guid tenantId, CancellationToken cancellationToken = default)
        => await Context.Payments.Where(p => p.TenantId == tenantId).ToListAsync(cancellationToken);

    public async Task<Payment?> GetByBookingIdAsync(Guid bookingId, CancellationToken cancellationToken = default)
        => await Context.Payments.FirstOrDefaultAsync(p => p.BookingId == bookingId, cancellationToken);
}
