using System;
using System.IO;
using System.IO.Pipes;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using EchoLingo.Ipc.Dispatcher;
using EchoLingo.Ipc.Protocol;

namespace EchoLingo.Ipc.NamedPipe;

public class NamedPipeIpcServer : IDisposable
{
    private readonly CommandDispatcher _dispatcher;
    private readonly string _pipeName;
    private readonly JsonSerializerOptions _jsonOpts;
    private readonly CancellationTokenSource _cts = new();
    private bool _disposed;

    public NamedPipeIpcServer(CommandDispatcher dispatcher, string pipeName, JsonSerializerOptions jsonOpts)
    {
        _dispatcher = dispatcher ?? throw new ArgumentNullException(nameof(dispatcher));
        _pipeName = pipeName ?? throw new ArgumentNullException(nameof(pipeName));
        _jsonOpts = jsonOpts ?? throw new ArgumentNullException(nameof(jsonOpts));
    }

    public async Task RunAsync()
    {
        Console.Error.WriteLine($"[EchoLingo.Ipc] Starting named pipe server on '{_pipeName}'");

        // Background task: monitor stdin for termination ("exit" or EOF if parent process dies)
        _ = Task.Run(async () =>
        {
            try
            {
                while (await Console.In.ReadLineAsync().ConfigureAwait(false) is { } line)
                {
                    if (line.Trim().Equals("exit", StringComparison.OrdinalIgnoreCase) ||
                        line.Trim().Equals("quit", StringComparison.OrdinalIgnoreCase))
                    {
                        _cts.Cancel();
                        return;
                    }
                }
                // Stdin EOF reached: parent process died or closed stdin pipe
                _cts.Cancel();
            }
            catch
            {
                // Ignore stdin monitoring errors
            }
        });

        while (!_cts.IsCancellationRequested)
        {
            NamedPipeServerStream? serverStream = null;
            try
            {
                serverStream = new NamedPipeServerStream(
                    _pipeName,
                    PipeDirection.InOut,
                    NamedPipeServerStream.MaxAllowedServerInstances,
                    PipeTransmissionMode.Byte,
                    PipeOptions.Asynchronous);

                Console.Error.WriteLine($"[EchoLingo.Ipc] Waiting for client connection on named pipe: {_pipeName}...");
                await serverStream.WaitForConnectionAsync(_cts.Token).ConfigureAwait(false);
                Console.Error.WriteLine($"[EchoLingo.Ipc] Client connected to named pipe: {_pipeName}");

                // Process this client asynchronously so the server can accept subsequent / concurrent connections
                _ = ProcessClientAsync(serverStream, _cts.Token);
            }
            catch (OperationCanceledException)
            {
                serverStream?.Dispose();
                break;
            }
            catch (Exception ex)
            {
                serverStream?.Dispose();
                if (_cts.IsCancellationRequested) break;
                Console.Error.WriteLine($"[EchoLingo.Ipc] Pipe server error: {ex.Message}");
                try
                {
                    await Task.Delay(200, _cts.Token).ConfigureAwait(false);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
            }
        }

        Console.Error.WriteLine($"[EchoLingo.Ipc] Named pipe server loop ended for '{_pipeName}'.");
    }

    private async Task ProcessClientAsync(NamedPipeServerStream serverStream, CancellationToken ct)
    {
        using (serverStream)
        {
            var writeLock = new SemaphoreSlim(1, 1);
            try
            {
                using var reader = new StreamReader(serverStream, Encoding.UTF8, leaveOpen: true);
                using var writer = new StreamWriter(serverStream, Encoding.UTF8, leaveOpen: true) { AutoFlush = true };

                while (serverStream.IsConnected && !ct.IsCancellationRequested)
                {
                    string? rawMessage = await reader.ReadLineAsync(ct).ConfigureAwait(false);
                    if (rawMessage == null)
                    {
                        // Client closed pipe
                        break;
                    }

                    var trimmed = rawMessage.Trim();
                    if (string.IsNullOrWhiteSpace(trimmed)) continue;

                    if (trimmed.Equals("exit", StringComparison.OrdinalIgnoreCase) ||
                        trimmed.Equals("quit", StringComparison.OrdinalIgnoreCase))
                    {
                        var exitResponse = IpcResponse.Ok(null, new { status = "exiting" });
                        await SafeWriteAsync(writer, writeLock, JsonSerializer.Serialize(exitResponse, _jsonOpts), serverStream, ct).ConfigureAwait(false);
                        _cts.Cancel();
                        return;
                    }

                    IpcRequest? request;
                    try
                    {
                        request = JsonSerializer.Deserialize<IpcRequest>(trimmed, _jsonOpts);
                    }
                    catch (Exception ex)
                    {
                        var errResponse = IpcResponse.Fail(null, $"Invalid JSON request: {ex.Message}");
                        await SafeWriteAsync(writer, writeLock, JsonSerializer.Serialize(errResponse, _jsonOpts), serverStream, ct).ConfigureAwait(false);
                        continue;
                    }

                    if (request == null)
                    {
                        var errResponse = IpcResponse.Fail(null, "Request payload was empty or null");
                        await SafeWriteAsync(writer, writeLock, JsonSerializer.Serialize(errResponse, _jsonOpts), serverStream, ct).ConfigureAwait(false);
                        continue;
                    }

                    if (request.Command.Equals("exit", StringComparison.OrdinalIgnoreCase) ||
                        request.Command.Equals("quit", StringComparison.OrdinalIgnoreCase))
                    {
                        var exitResponse = IpcResponse.Ok(request.Id, new { status = "exiting" });
                        await SafeWriteAsync(writer, writeLock, JsonSerializer.Serialize(exitResponse, _jsonOpts), serverStream, ct).ConfigureAwait(false);
                        _cts.Cancel();
                        return;
                    }

                    // Dispatch command asynchronously
                    _ = Task.Run(async () =>
                    {
                        IpcResponse response;
                        try
                        {
                            response = await _dispatcher.DispatchAsync(request).ConfigureAwait(false);
                        }
                        catch (Exception ex)
                        {
                            response = IpcResponse.Fail(request.Id, $"Dispatch error: {ex.Message}");
                        }

                        var json = JsonSerializer.Serialize(response, _jsonOpts);
                        await SafeWriteAsync(writer, writeLock, json, serverStream, ct).ConfigureAwait(false);
                    }, ct);
                }
            }
            catch (OperationCanceledException)
            {
                // Expected when shutting down
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[EchoLingo.Ipc] Error in pipe client session: {ex.Message}");
            }
            finally
            {
                writeLock.Dispose();
                Console.Error.WriteLine($"[EchoLingo.Ipc] Client disconnected from pipe '{_pipeName}'.");
            }
        }
    }

    private static async Task SafeWriteAsync(
        StreamWriter writer,
        SemaphoreSlim writeLock,
        string json,
        NamedPipeServerStream serverStream,
        CancellationToken ct)
    {
        try
        {
            await writeLock.WaitAsync(ct).ConfigureAwait(false);
            try
            {
                if (serverStream.IsConnected)
                {
                    await writer.WriteLineAsync(json).ConfigureAwait(false);
                }
            }
            finally
            {
                writeLock.Release();
            }
        }
        catch
        {
            // Ignore write failures when client is disconnecting
        }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _cts.Cancel();
        _cts.Dispose();
    }
}

