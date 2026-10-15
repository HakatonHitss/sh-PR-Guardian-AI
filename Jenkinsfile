@Library('master-library-bitbucket-new')_

import com.claro.models.angular.Configuracion
import com.claro.models.angular.Manifiesto

def configuraciones = [
	new Configuracion(
		llave		: "config-nginx",
		archivo		: "nginx.template",
		rutaOrigen	: "nginx",
	)
]

def manifiesto = new Manifiesto(
	rutaManifiesto		: "namespaces/channel-miclaro",
	nombreAplicacion	: "sh-pr-guardian-ai",
	parteDe				: "channel-miclaro",
	propietario			: "channel-miclaro",
	nivel				: "S"
)

angularMFEPipeline([
	rutaConfiguracion	: 'openshift/channel-miclaro',
	configuraciones		: configuraciones,
	manifiesto			: manifiesto,
])