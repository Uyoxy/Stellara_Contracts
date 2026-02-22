{{- define "marketplace-service.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "marketplace-service.fullname" -}}
{{- printf "%s-%s" (include "marketplace-service.name" .) .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
