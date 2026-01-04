export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-dark-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-dark-800 rounded-xl border border-dark-700 p-8">
          <h1 className="text-3xl font-bold text-white mb-2">Política de Privacidade</h1>
          <p className="text-dark-400 mb-8">Última atualização: Janeiro de 2025</p>

          <div className="prose prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-white mb-3">1. Introdução</h2>
              <p className="text-dark-300 leading-relaxed">
                A VIPS.lat ("nós", "nosso" ou "Plataforma") está comprometida com a proteção da sua privacidade.
                Esta Política de Privacidade explica como coletamos, usamos, armazenamos e protegemos suas informações
                pessoais em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018) e demais
                legislações aplicáveis.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">2. Dados que Coletamos</h2>
              <p className="text-dark-300 leading-relaxed">Coletamos os seguintes tipos de informações:</p>

              <h3 className="text-lg font-medium text-white mt-4 mb-2">2.1 Dados de Cadastro</h3>
              <ul className="list-disc list-inside text-dark-300 space-y-1">
                <li>Nome completo</li>
                <li>Endereço de e-mail</li>
                <li>Nome de usuário</li>
                <li>Senha (armazenada de forma criptografada)</li>
                <li>Foto de perfil (opcional)</li>
              </ul>

              <h3 className="text-lg font-medium text-white mt-4 mb-2">2.2 Dados de Criadores (Verificação KYC)</h3>
              <ul className="list-disc list-inside text-dark-300 space-y-1">
                <li>CPF ou CNPJ</li>
                <li>Documento de identidade (RG, CNH ou Passaporte)</li>
                <li>Selfie para verificação facial</li>
                <li>Chave PIX para recebimento de pagamentos</li>
              </ul>

              <h3 className="text-lg font-medium text-white mt-4 mb-2">2.3 Dados de Uso</h3>
              <ul className="list-disc list-inside text-dark-300 space-y-1">
                <li>Endereço IP e geolocalização aproximada</li>
                <li>Tipo de dispositivo e navegador</li>
                <li>Páginas visitadas e tempo de permanência</li>
                <li>Histórico de transações e assinaturas</li>
                <li>Interações com conteúdo (curtidas, comentários)</li>
              </ul>

              <h3 className="text-lg font-medium text-white mt-4 mb-2">2.4 Dados de Pagamento</h3>
              <ul className="list-disc list-inside text-dark-300 space-y-1">
                <li>Histórico de transações</li>
                <li>Dados de cobrança (processados por parceiros de pagamento)</li>
              </ul>
              <p className="text-dark-300 mt-2">
                Nota: Não armazenamos dados completos de cartão de crédito. Estes são processados diretamente por
                nossos parceiros de pagamento certificados PCI-DSS.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">3. Como Usamos seus Dados</h2>
              <p className="text-dark-300 leading-relaxed">Utilizamos suas informações para:</p>
              <ul className="list-disc list-inside text-dark-300 mt-2 space-y-1">
                <li>Fornecer e manter nossos serviços</li>
                <li>Processar pagamentos e transferências</li>
                <li>Verificar identidade de criadores (prevenção de fraude)</li>
                <li>Enviar notificações sobre sua conta e transações</li>
                <li>Responder a solicitações de suporte</li>
                <li>Melhorar a experiência do usuário</li>
                <li>Cumprir obrigações legais e regulatórias</li>
                <li>Prevenir fraudes e atividades ilegais</li>
                <li>Personalizar conteúdo e recomendações</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">4. Base Legal para Tratamento (LGPD)</h2>
              <p className="text-dark-300 leading-relaxed">Tratamos seus dados com base nas seguintes hipóteses legais:</p>
              <ul className="list-disc list-inside text-dark-300 mt-2 space-y-1">
                <li><strong>Execução de contrato:</strong> Para fornecer os serviços contratados</li>
                <li><strong>Consentimento:</strong> Quando você opta por fornecer dados adicionais</li>
                <li><strong>Obrigação legal:</strong> Para cumprir exigências legais e fiscais</li>
                <li><strong>Legítimo interesse:</strong> Para prevenção de fraudes e melhoria dos serviços</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">5. Compartilhamento de Dados</h2>
              <p className="text-dark-300 leading-relaxed">Podemos compartilhar seus dados com:</p>
              <ul className="list-disc list-inside text-dark-300 mt-2 space-y-1">
                <li><strong>Processadores de pagamento:</strong> Para realizar transações financeiras</li>
                <li><strong>Provedores de serviço:</strong> Hospedagem, e-mail, armazenamento em nuvem</li>
                <li><strong>Autoridades governamentais:</strong> Quando exigido por lei ou ordem judicial</li>
              </ul>
              <p className="text-dark-300 mt-2">
                Não vendemos, alugamos ou compartilhamos seus dados pessoais com terceiros para fins de marketing
                sem seu consentimento expresso.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">6. Armazenamento e Segurança</h2>
              <p className="text-dark-300 leading-relaxed">
                Seus dados são armazenados em servidores seguros com as seguintes medidas de proteção:
              </p>
              <ul className="list-disc list-inside text-dark-300 mt-2 space-y-1">
                <li>Criptografia em trânsito (HTTPS/TLS)</li>
                <li>Criptografia em repouso para dados sensíveis</li>
                <li>Controle de acesso baseado em funções</li>
                <li>Monitoramento contínuo de segurança</li>
                <li>Backups regulares com criptografia</li>
                <li>Senhas armazenadas com hash seguro (bcrypt)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">7. Retenção de Dados</h2>
              <p className="text-dark-300 leading-relaxed">Mantemos seus dados pelo tempo necessário para:</p>
              <ul className="list-disc list-inside text-dark-300 mt-2 space-y-1">
                <li><strong>Dados de conta:</strong> Enquanto a conta estiver ativa, mais 5 anos após exclusão</li>
                <li><strong>Dados financeiros:</strong> 10 anos (obrigação fiscal)</li>
                <li><strong>Dados de KYC:</strong> 5 anos após encerramento da conta</li>
                <li><strong>Logs de acesso:</strong> 6 meses</li>
                <li><strong>Conteúdo publicado:</strong> Até exclusão pelo usuário ou encerramento da conta</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">8. Seus Direitos (LGPD)</h2>
              <p className="text-dark-300 leading-relaxed">Conforme a LGPD, você tem direito a:</p>
              <ul className="list-disc list-inside text-dark-300 mt-2 space-y-1">
                <li><strong>Confirmação:</strong> Saber se tratamos seus dados</li>
                <li><strong>Acesso:</strong> Obter cópia dos dados que temos sobre você</li>
                <li><strong>Correção:</strong> Corrigir dados incompletos ou incorretos</li>
                <li><strong>Anonimização/Bloqueio/Eliminação:</strong> De dados desnecessários ou excessivos</li>
                <li><strong>Portabilidade:</strong> Receber seus dados em formato estruturado</li>
                <li><strong>Eliminação:</strong> Solicitar exclusão de dados tratados com consentimento</li>
                <li><strong>Informação:</strong> Saber com quem compartilhamos seus dados</li>
                <li><strong>Revogação:</strong> Revogar consentimento a qualquer momento</li>
                <li><strong>Oposição:</strong> Opor-se a tratamento em certas circunstâncias</li>
              </ul>
              <p className="text-dark-300 mt-2">
                Para exercer esses direitos, entre em contato através do e-mail:
                <a href="mailto:privacidade@vips.lat" className="text-brand-500 hover:text-brand-400 ml-1">privacidade@vips.lat</a>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">9. Cookies e Tecnologias Similares</h2>
              <p className="text-dark-300 leading-relaxed">Utilizamos cookies para:</p>
              <ul className="list-disc list-inside text-dark-300 mt-2 space-y-1">
                <li><strong>Cookies essenciais:</strong> Autenticação e funcionamento básico</li>
                <li><strong>Cookies de preferências:</strong> Lembrar suas configurações</li>
                <li><strong>Cookies analíticos:</strong> Entender como você usa a Plataforma</li>
              </ul>
              <p className="text-dark-300 mt-2">
                Você pode gerenciar cookies através das configurações do seu navegador. Desativar cookies essenciais
                pode afetar o funcionamento da Plataforma.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">10. Transferência Internacional de Dados</h2>
              <p className="text-dark-300 leading-relaxed">
                Alguns de nossos provedores de serviço podem estar localizados fora do Brasil. Nesses casos, garantimos
                que a transferência ocorra em conformidade com a LGPD, utilizando cláusulas contratuais padrão ou
                outros mecanismos de proteção adequados.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">11. Menores de Idade</h2>
              <p className="text-dark-300 leading-relaxed">
                A Plataforma é destinada exclusivamente a maiores de 18 anos. Não coletamos intencionalmente dados
                de menores. Se identificarmos que um menor se cadastrou, a conta será imediatamente encerrada e os
                dados excluídos.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">12. Incidentes de Segurança</h2>
              <p className="text-dark-300 leading-relaxed">
                Em caso de incidente de segurança que possa afetar seus dados, notificaremos você e a Autoridade
                Nacional de Proteção de Dados (ANPD) conforme exigido pela LGPD, informando a natureza do incidente
                e as medidas adotadas.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">13. Alterações nesta Política</h2>
              <p className="text-dark-300 leading-relaxed">
                Podemos atualizar esta Política periodicamente. Alterações significativas serão comunicadas por e-mail
                ou notificação na Plataforma. Recomendamos revisar esta página regularmente.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">14. Encarregado de Dados (DPO)</h2>
              <p className="text-dark-300 leading-relaxed">
                Para questões relacionadas ao tratamento de dados pessoais, entre em contato com nosso Encarregado
                de Proteção de Dados:
              </p>
              <p className="text-dark-300 mt-2">
                E-mail: <a href="mailto:dpo@vips.lat" className="text-brand-500 hover:text-brand-400">dpo@vips.lat</a>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">15. Contato</h2>
              <p className="text-dark-300 leading-relaxed">
                Para dúvidas, solicitações ou reclamações sobre esta Política de Privacidade:
              </p>
              <ul className="list-none text-dark-300 mt-2 space-y-1">
                <li>E-mail geral: <a href="mailto:suporte@vips.lat" className="text-brand-500 hover:text-brand-400">suporte@vips.lat</a></li>
                <li>Privacidade: <a href="mailto:privacidade@vips.lat" className="text-brand-500 hover:text-brand-400">privacidade@vips.lat</a></li>
                <li>DPO: <a href="mailto:dpo@vips.lat" className="text-brand-500 hover:text-brand-400">dpo@vips.lat</a></li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">16. Autoridade Nacional de Proteção de Dados</h2>
              <p className="text-dark-300 leading-relaxed">
                Caso entenda que o tratamento de seus dados viola a legislação, você pode apresentar reclamação à
                Autoridade Nacional de Proteção de Dados (ANPD) através do site:
                <a
                  href="https://www.gov.br/anpd"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-500 hover:text-brand-400 ml-1"
                >
                  www.gov.br/anpd
                </a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
