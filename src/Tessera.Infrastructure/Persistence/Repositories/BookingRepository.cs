using Microsoft.EntityFrameworkCore;
using Tessera.Domain.Entities;
using Tessera.Domain.Repositories;

namespace Tessera.Infrastructure.Persistence.Repositories;

public class BookingRepository(TesseraDbContext context) : Repository<Booking>(context), IBookingRepository
{
    public async Task<IEnumerable<Booking>> GetByParticipantIdAsync(Guid participantId, CancellationToken cancellationToken = default)
        => await Context.Bookings.Where(b => b.ParticipantId == participantId).ToListAsync(cancellationToken);

    public async Task<IEnumerable<Booking>> GetBySessionIdAsync(Guid sessionId, CancellationToken cancellationToken = default)
        => await Context.Bookings.Where(b => b.ClassSessionId == sessionId).ToListAsync(cancellationToken);
}
