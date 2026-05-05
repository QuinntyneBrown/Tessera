using MediatR;
using Tessera.Application.Bookings.Dtos;
using Tessera.Application.Common.Exceptions;
using Tessera.Domain.Entities;
using Tessera.Domain.Repositories;

namespace Tessera.Application.Bookings.Commands.CreateBooking;

public class CreateBookingCommandHandler(
    IBookingRepository bookingRepository,
    IClassSessionRepository sessionRepository,
    IParticipantRepository participantRepository,
    IUnitOfWork unitOfWork)
    : IRequestHandler<CreateBookingCommand, BookingDto>
{
    public async Task<BookingDto> Handle(CreateBookingCommand request, CancellationToken cancellationToken)
    {
        var session = await sessionRepository.GetByIdAsync(request.ClassSessionId, cancellationToken)
            ?? throw new NotFoundException(nameof(ClassSession), request.ClassSessionId);

        var participant = await participantRepository.GetByIdAsync(request.ParticipantId, cancellationToken)
            ?? throw new NotFoundException(nameof(Participant), request.ParticipantId);

        var booking = Booking.Create(request.TenantId, request.ClassSessionId, request.ParticipantId);
        booking.Confirm();
        bookingRepository.Add(booking);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return new BookingDto(booking.Id, booking.TenantId, booking.ClassSessionId,
            booking.ParticipantId, participant.FullName, booking.Status.ToString(),
            booking.AmountPaid, booking.CreatedAt);
    }
}
