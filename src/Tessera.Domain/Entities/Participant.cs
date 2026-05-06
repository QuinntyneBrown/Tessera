using Tessera.Domain.Common;

namespace Tessera.Domain.Entities;

public class Participant : BaseEntity, ITenantEntity
{
    private Participant() { }

    public Guid TenantId { get; private set; }
    public string FirstName { get; private set; } = default!;
    public string LastName { get; private set; } = default!;
    public string Email { get; private set; } = default!;
    public string? PhoneNumber { get; private set; }
    public bool IsActive { get; private set; } = true;

    public string FullName => $"{FirstName} {LastName}";

    public ICollection<Booking> Bookings { get; private set; } = [];

    public static Participant Create(Guid tenantId, string firstName, string lastName, string email)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(firstName);
        ArgumentException.ThrowIfNullOrWhiteSpace(lastName);
        ArgumentException.ThrowIfNullOrWhiteSpace(email);

        return new Participant
        {
            TenantId = tenantId,
            FirstName = firstName,
            LastName = lastName,
            Email = email.ToLowerInvariant()
        };
    }

    public void Update(string firstName, string lastName, string? phoneNumber)
    {
        FirstName = firstName;
        LastName = lastName;
        PhoneNumber = phoneNumber;
        SetUpdatedAt();
    }
}
