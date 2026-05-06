namespace Tessera.Web.Models;

public class BookingModel
{
    public Guid Id { get; set; }
    public Guid ClassSessionId { get; set; }
    public Guid ParticipantId { get; set; }
    public string ParticipantName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public decimal AmountPaid { get; set; }
    public DateTime CreatedAt { get; set; }
}
