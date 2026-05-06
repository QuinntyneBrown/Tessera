using FluentValidation;

namespace Tessera.Application.Bookings.Commands.CreateBooking;

public class CreateBookingCommandValidator : AbstractValidator<CreateBookingCommand>
{
    public CreateBookingCommandValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
        RuleFor(x => x.ClassSessionId).NotEmpty();
        RuleFor(x => x.ParticipantId).NotEmpty();
    }
}
