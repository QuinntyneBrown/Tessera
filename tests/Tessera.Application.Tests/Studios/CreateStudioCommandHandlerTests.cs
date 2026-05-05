using Moq;
using Tessera.Application.Studios.Commands.CreateStudio;
using Tessera.Domain.Entities;
using Tessera.Domain.Repositories;
using Xunit;

namespace Tessera.Application.Tests.Studios;

public class CreateStudioCommandHandlerTests
{
    private readonly Mock<IStudioRepository> _studioRepositoryMock = new();
    private readonly Mock<IUnitOfWork> _unitOfWorkMock = new();

    [Fact]
    public async Task Handle_ShouldCreateStudio_AndReturnDto()
    {
        var handler = new CreateStudioCommandHandler(_studioRepositoryMock.Object, _unitOfWorkMock.Object);
        var command = new CreateStudioCommand(
            TenantId: Guid.NewGuid(),
            Name: "Downtown Studio",
            Description: "Main studio",
            Address: "123 Main St",
            City: "Austin",
            PhoneNumber: "555-0100",
            Email: "info@downtown.com");

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.Equal("Downtown Studio", result.Name);
        Assert.Equal("Austin", result.City);
        _studioRepositoryMock.Verify(r => r.Add(It.IsAny<Studio>()), Times.Once);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
