import { budgetEvents, calculateBudgetState } from '@/lib/budget-service';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial state on connection
      try {
        const initial = calculateBudgetState();
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'INITIAL_STATE', payload: initial })}\n\n`));
      } catch (e) {
        console.error('Error sending initial SSE state:', e);
      }

      const onUpdate = (data) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch (e) {
          // Controller might be closed
        }
      };

      budgetEvents.on('update', onUpdate);

      // Keep-alive heartbeat ping every 25 seconds
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch (e) {
          clearInterval(heartbeat);
        }
      }, 25000);

      req.signal.addEventListener('abort', () => {
        budgetEvents.off('update', onUpdate);
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch (e) {}
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    }
  });
}
