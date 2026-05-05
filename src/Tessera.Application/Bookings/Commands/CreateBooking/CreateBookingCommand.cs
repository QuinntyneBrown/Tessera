using MediatR;
using Tessera.Application.Bookings.Dtos;

namespace Tessera.Application.Bookings.Commands.CreateBooking;

public record CreateBookingCommand(
    Guid TenantId,
    Guid ClassSessionId,
    Guid ParticipantId) : IRequest<BookingDto>;
