import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen, Swords, Trophy, Clock, AlertTriangle, CheckCircle } from 'lucide-react'

export default function RegulamentoPage() {
  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="size-6" />
          Regulamento
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Torneio Escada EMTP 2026</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="size-4" />
            Formato
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <p>O torneio funciona em formato de <strong className="text-foreground">escada (ladder)</strong> — as duplas estão ordenadas por posição e podem desafiar duplas acima delas no ranking.</p>
          <p>Cada categoria tem a sua própria escada independente.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Swords className="size-4" />
            Desafios
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <ul className="space-y-2">
            <li>• Uma dupla pode desafiar as <strong className="text-foreground">2 duplas imediatamente acima</strong> no ranking.</li>
            <li>• Não é permitido desafiar a dupla que se enfrentou no jogo anterior.</li>
            <li>• Só é possível ter <strong className="text-foreground">um desafio ativo</strong> de cada vez.</li>
            <li>• A dupla desafiada tem de aceitar o desafio e acordar um horário.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="size-4" />
            Prazos e horários
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <ul className="space-y-2">
            <li>• Após um desafio ser lançado, as duplas têm <strong className="text-foreground">7 dias</strong> para jogar.</li>
            <li>• O horário é proposto por uma dupla, aceite pela outra e confirmado pelo admin.</li>
            <li>• Se não houver acordo no prazo, a organização intervém.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle className="size-4" />
            Formato dos jogos
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <ul className="space-y-2">
            <li>• Os jogos são disputados ao <strong className="text-foreground">melhor de 3 sets</strong>.</li>
            <li>• Cada set é ganho com <strong className="text-foreground">6 jogos</strong> (com diferença de 2).</li>
            <li>• Em caso de igualdade (1-1 em sets), joga-se um <strong className="text-foreground">3.º set completo</strong>.</li>
            <li>• O resultado é submetido por uma das duplas e confirmado pela outra.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="size-4 text-yellow-500" />
            Ranking
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <ul className="space-y-2">
            <li>• Se a <strong className="text-foreground">dupla desafiante vencer</strong>, sobe para a posição da dupla desafiada. As duplas entre elas descem uma posição.</li>
            <li>• Se a <strong className="text-foreground">dupla desafiada vencer</strong>, as posições não se alteram.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="size-4 text-orange-500" />
            Faltas e penalizações
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <ul className="space-y-2">
            <li>• A dupla que não comparecer sem aviso prévio perde o jogo por <strong className="text-foreground">walkover</strong>.</li>
            <li>• Em caso de litígio, a organização decide com base nos elementos disponíveis.</li>
            <li>• A organização pode corrigir resultados ou posições em caso de erro.</li>
          </ul>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center pb-4">
        Escola Municipal de Ténis e Padel · Oliveira do Bairro
      </p>
    </div>
  )
}
