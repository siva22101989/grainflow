import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Quote } from 'lucide-react'

const testimonials = [
  {
    quote: "GrainFlow practically eliminated our billing errors. We used to spend hours on manual calculations every week.",
    author: "Rajesh Kumar",
    role: "Owner, Punjab Grain Store",
    initials: "RK"
  },
  {
    quote: "The customer portal changed everything. Our farmers can check their balance anytime without calling us.",
    author: "Priya Sharma",
    role: "Manager, Maharashtra Cooperative",
    initials: "PS"
  },
  {
    quote: "SMS notifications keep our customers informed automatically. Payment collection has never been smoother.",
    author: "Amit Patel",
    role: "Director, Gujarat APMC",
    initials: "AP"
  }
]

export function Testimonials() {
  return (
    <section className="py-20 px-6 bg-primary/5">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Trusted by Warehouse Owners Across India
          </h2>
          <p className="text-lg text-muted-foreground">
            See what our customers have to say
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="relative">
              <CardContent className="pt-8 pb-6">
                <Quote className="h-8 w-8 text-primary/20 mb-4" />
                <p className="text-lg mb-6 italic">
                  "{testimonial.quote}"
                </p>
                <div className="flex items-center gap-4">
                  <Avatar>
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                      {testimonial.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-bold">{testimonial.author}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
