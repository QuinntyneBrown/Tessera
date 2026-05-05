using MediatR;
using Tessera.Application.Common.Exceptions;
using Tessera.Application.Common.Interfaces;
using Tessera.Application.Payments.Dtos;
using Tessera.Domain.Entities;
using Tessera.Domain.Repositories;

namespace Tessera.Application.Payments.Commands.ProcessPayment;

public class ProcessPaymentCommandHandler(
    IPaymentRepository paymentRepository,
    IBookingRepository bookingRepository,
    IPaymentGateway paymentGateway,
    IUnitOfWork unitOfWork)
    : IRequestHandler<ProcessPaymentCommand, PaymentDto>
{
    public async Task<PaymentDto> Handle(ProcessPaymentCommand request, CancellationToken cancellationToken)
    {
        var booking = await bookingRepository.GetByIdAsync(request.BookingId, cancellationToken)
            ?? throw new NotFoundException(nameof(Booking), request.BookingId);

        var paymentMethod = Enum.Parse<PaymentMethod>(request.PaymentMethod, ignoreCase: true);
        var payment = Payment.Create(request.TenantId, request.BookingId, request.Amount, paymentMethod, request.Currency);

        var result = await paymentGateway.ProcessPaymentAsync(
            new PaymentRequest(request.Amount, request.Currency, request.PaymentMethodToken, $"Booking {request.BookingId}"),
            cancellationToken);

        if (result.Succeeded)
        {
            payment.MarkSucceeded(result.ExternalPaymentId!);
            booking.RecordPayment(request.Amount);
        }
        else
        {
            payment.MarkFailed(result.FailureReason ?? "Unknown error");
        }

        paymentRepository.Add(payment);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return new PaymentDto(payment.Id, payment.TenantId, payment.BookingId, payment.Amount,
            payment.Currency, payment.Status.ToString(), payment.Method.ToString(),
            payment.ExternalPaymentId, payment.CreatedAt);
    }
}
