using Tessera.Domain.Entities;

namespace Tessera.Domain.Repositories;

public interface IBookingRepository : IRepository<Booking>
{
    Task<IEnumerable<Booking>> GetByParticipantIdAsync(Guid participantId, CancellationToken cancellationToken = default);
    Task<IEnumerable<Booking>> GetBySessionIdAsync(Guid sessionId, CancellationToken cancellationToken = default);
}
