import type { z } from 'zod'
import type { ClientSession } from 'mongoose'
import type {
  deliveryPurposeSchema,
  deliveryErrorSchema,
  enqueueOptionsSchema,
  deliveryReceiptSchema,
  deliverySchema,
  claimedEmailSchema,
  smtpFailureSchema,
  createDeliverySchema,
  terminalDeliveryStatusSchema,
  deliveryListOptionsSchema,
  deliveryListSchema,
  workerHeartbeatSchema,
  workerSnapshotSchema,
  deliveryStatsSchema,
  workerStatusSchema,
  deliveryCursorSchema
} from './schemas.ts'

export type DeliveryPurposeDto = z.infer<typeof deliveryPurposeSchema>
export type DeliveryErrorDto = z.infer<typeof deliveryErrorSchema>
export type EnqueueOptionsDto = z.input<typeof enqueueOptionsSchema>
export type DeliveryReceiptDto = z.infer<typeof deliveryReceiptSchema>
export type DeliveryDto = z.infer<typeof deliverySchema>
export type ClaimedEmailDto = z.infer<typeof claimedEmailSchema>
export type SmtpFailureDto = z.infer<typeof smtpFailureSchema>
export type CreateDeliveryDto = z.infer<typeof createDeliverySchema>
export type TerminalDeliveryStatusDto = z.infer<
  typeof terminalDeliveryStatusSchema
>

export type EnqueueContextDto = {
  session?: ClientSession
  options?: EnqueueOptionsDto
}

export type DeliveryListOptionsDto = z.input<typeof deliveryListOptionsSchema>
export type DeliveryListDto = z.infer<typeof deliveryListSchema>
export type WorkerHeartbeatDto = z.infer<typeof workerHeartbeatSchema>
export type WorkerSnapshotDto = z.infer<typeof workerSnapshotSchema>
export type DeliveryStatsDto = z.infer<typeof deliveryStatsSchema>
export type WorkerStatusDto = z.infer<typeof workerStatusSchema>

export type DeliveryCursorDto = z.infer<typeof deliveryCursorSchema>
