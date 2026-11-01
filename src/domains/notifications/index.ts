export { notificationService } from './service.ts'
export { registerEmailTemplate, listEmailTemplates } from './registry.ts'
export { initializeMailTemplates } from './renderer.ts'
export type {
  EnqueueContextDto,
  EnqueueOptionsDto,
  DeliveryDto,
  DeliveryReceiptDto
} from './delivery/dto.ts'
export type {
  AccountNotificationDto,
  AccountTemplateDto,
  SendTemplateDto,
  RegisterTemplateDto,
  TemplateListResponseDto,
  RenderedNotificationDto
} from './dto.ts'
