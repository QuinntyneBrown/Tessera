using System.Net.Http.Json;
using Tessera.Web.Models;

namespace Tessera.Web.Services;

public class ApiClient(HttpClient httpClient)
{
    public async Task<List<StudioModel>> GetStudiosAsync(Guid tenantId)
        => await httpClient.GetFromJsonAsync<List<StudioModel>>($"api/tenants/{tenantId}/studios") ?? [];

    public async Task<StudioModel?> CreateStudioAsync(Guid tenantId, StudioModel model)
        => await httpClient.PostAsJsonAsync($"api/tenants/{tenantId}/studios", model)
            .ContinueWith(t => t.Result.Content.ReadFromJsonAsync<StudioModel>()).Unwrap();

    public async Task<BookingModel?> CreateBookingAsync(Guid tenantId, Guid classSessionId, Guid participantId)
    {
        var response = await httpClient.PostAsJsonAsync($"api/tenants/{tenantId}/bookings",
            new { ClassSessionId = classSessionId, ParticipantId = participantId });
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<BookingModel>();
    }

    public async Task<PaymentModel?> ProcessPaymentAsync(Guid tenantId, Guid bookingId, decimal amount, string token)
    {
        var response = await httpClient.PostAsJsonAsync($"api/tenants/{tenantId}/payments",
            new { BookingId = bookingId, Amount = amount, Currency = "USD", PaymentMethodToken = token, PaymentMethod = "CreditCard" });
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<PaymentModel>();
    }
}
