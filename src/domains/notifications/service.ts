import type { ClientSession } from 'mongoose'
import { renderNotification } from './renderer.ts'
import { enqueueTemplate } from './delivery/service.ts'
import { deliveryRepository } from './delivery/repository.ts'
import type { AccountNotificationDto, AccountTemplateDto } from './dto.ts'

const enqueueAccount = (
  template: AccountTemplateDto,
  { email, language, accessToken, ownerId, expiresAt }: AccountNotificationDto,
  session: ClientSession
) =>
  enqueueTemplate(
    {
      template,
      email,
      language,
      variables: accessToken === undefined ? {} : { accessToken }
    },
    {
      session,
      options: {
        ownerId,
        expiresAt,
        purpose:
          template === 'resetPassword'
            ? 'resetPassword'
            : template === 'verification'
              ? 'verification'
              : 'account'
      }
    }
  )

export const notificationService = {
  renderTemplate: renderNotification,
  enqueueTemplate,
  enqueueAccount,
  getDelivery: deliveryRepository.getDelivery,
  retryFailed: deliveryRepository.retryFailed,
  cancelPending: deliveryRepository.cancelPending
}
