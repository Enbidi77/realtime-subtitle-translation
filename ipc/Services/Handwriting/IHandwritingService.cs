using System.Threading.Tasks;
using EchoLingo.Ipc.Protocol;

namespace EchoLingo.Ipc.Services.Handwriting;

public interface IHandwritingService
{
    Task<HandwritingRecognizeResult> RecognizeAsync(HandwritingRecognizeRequest request);
}
