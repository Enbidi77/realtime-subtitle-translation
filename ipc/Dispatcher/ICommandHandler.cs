using System.Text.Json;
using System.Threading.Tasks;

namespace EchoLingo.Ipc.Dispatcher;

public interface ICommandHandler
{
    string CommandName { get; }
    Task<object?> HandleAsync(JsonElement? payload);
}

