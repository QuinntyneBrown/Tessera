namespace Tessera.Application.Bookings.Dtos;

public record BookingDto(
    Guid Id,
    Guid TenantId,
    Guid ClassSessionId,
    Guid ParticipantId,
    string ParticipantName,
    string Status,
    decimal AmountPaid,
    DateTime CreatedAt);
