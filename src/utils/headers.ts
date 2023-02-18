export const getAccessTokenFromHeaders = ({
  authorization
}: {
  authorization?: string
}) => ({ accessToken: authorization?.split(' ')[1] })
