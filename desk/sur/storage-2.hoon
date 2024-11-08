|%
+$  service  ?(%presigned-url %credentials)
+$  credentials
  $:  endpoint=@t
      access-key-id=@t
      secret-access-key=@t
  ==
::
::  $configuration: the upload configuration
::
::    $buckets: the buckets available
::    $current-bucket: the current bucket we use to upload
::    $region: the region of the current bucket
::    $presigned-url: the presigned url endpoint
::    $service: whether to use a presigned url service or direct S3 uploads
::
+$  configuration
  $:  buckets=(set @t)
      current-bucket=@t
      region=@t
      presigned-url=@t
      =service
  ==
::
+$  action
  $%  [%set-endpoint endpoint=@t]
      [%set-access-key-id access-key-id=@t]
      [%set-secret-access-key secret-access-key=@t]
      [%add-bucket bucket=@t]
      [%remove-bucket bucket=@t]
      [%set-current-bucket bucket=@t]
      [%set-region region=@t]
      [%set-presigned-url url=@t]
      [%toggle-service =service]
  ==
::
+$  update
  $%  [%credentials =credentials]
      [%configuration =configuration]
      action
  ==
--
