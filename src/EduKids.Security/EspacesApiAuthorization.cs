using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text.Json;
using EduKids.Contracts;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

namespace EduKids.Security;

/// <summary>Checks space ownership and enabled categories through Espaces.Api while forwarding the caller JWT.</summary>
public sealed class EspacesApiAuthorization(
    IHttpClientFactory clients,
    IHttpContextAccessor contextAccessor,
    IConfiguration configuration)
{
    public async Task<bool> ParentOwnsSpace(Guid spaceId, ClaimsPrincipal user, CancellationToken ct)
    {
        if (!user.IsInRole("Parent") || !TryGetBearer(out var token)) return false;
        using var request = CreateRequest(token, $"espaces/{spaceId:D}");
        using var response = await Client().SendAsync(request, ct);
        return response.IsSuccessStatusCode;
    }

    public async Task<bool> ChildOwnsSpaceWithActivity(Guid spaceId, string engineType, ClaimsPrincipal user, CancellationToken ct)
    {
        if (!user.IsInRole("Enfant")
            || !Guid.TryParse(user.FindFirstValue("espaceId"), out var ownSpaceId)
            || ownSpaceId != spaceId
            || !TryGetBearer(out var token)) return false;

        using var request = CreateRequest(token, "mon-espace");
        using var response = await Client().SendAsync(request, ct);
        if (!response.IsSuccessStatusCode) return false;
        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var payload = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
        var categories = ReadStringList(payload.RootElement, "activites");
        return ActivityTypes.IsEnabled(categories, engineType);
    }

    public async Task<bool> ParentOwnsSpaceWithActivity(Guid spaceId, string engineType, ClaimsPrincipal user, CancellationToken ct)
    {
        if (!user.IsInRole("Parent") || !TryGetBearer(out var token)) return false;
        using var request = CreateRequest(token, $"espaces/{spaceId:D}");
        using var response = await Client().SendAsync(request, ct);
        if (!response.IsSuccessStatusCode) return false;
        await using var stream = await response.Content.ReadAsStreamAsync(ct);
        using var payload = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
        return ActivityTypes.IsEnabled(ReadStringList(payload.RootElement, "activites"), engineType);
    }

    private HttpClient Client()
    {
        var baseAddress = configuration["ServiceEndpoints:EspacesApi"] ?? "http://localhost:5092/";
        var client = clients.CreateClient("EspacesApi");
        if (client.BaseAddress is null)
        {
            if (!Uri.TryCreate(baseAddress, UriKind.Absolute, out var uri))
                throw new InvalidOperationException("ServiceEndpoints:EspacesApi must be an absolute URL.");
            client.BaseAddress = uri;
        }
        return client;
    }

    private static HttpRequestMessage CreateRequest(string token, string path)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return request;
    }

    private bool TryGetBearer(out string token)
    {
        token = string.Empty;
        var value = contextAccessor.HttpContext?.Request.Headers.Authorization.ToString();
        if (!AuthenticationHeaderValue.TryParse(value, out var header)
            || !string.Equals(header.Scheme, "Bearer", StringComparison.OrdinalIgnoreCase)
            || string.IsNullOrWhiteSpace(header.Parameter)) return false;
        token = header.Parameter;
        return true;
    }

    private static IReadOnlyList<string> ReadStringList(JsonElement root, string name)
    {
        if (!TryGetPropertyIgnoreCase(root, name, out var values)) return [];
        if (values.ValueKind == JsonValueKind.String)
            return (values.GetString() ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return values.ValueKind == JsonValueKind.Array
            ? values.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.String).Select(x => x.GetString()!).ToArray()
            : [];
    }

    private static bool TryGetPropertyIgnoreCase(JsonElement root, string name, out JsonElement value)
    {
        foreach (var property in root.EnumerateObject())
            if (string.Equals(property.Name, name, StringComparison.OrdinalIgnoreCase)) { value = property.Value; return true; }
        value = default;
        return false;
    }
}
